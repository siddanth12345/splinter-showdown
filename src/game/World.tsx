import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  G, MAG, FIRE_INTERVAL, DMG, PARRY_WINDOW, PARRY_CD, BUFF_TIME, DASH_CD, AIR_JUMPS, AIR_DASHES,
} from "./state";
import { Room, ROOM, OBSTACLES } from "./Room";
import { tableWood } from "./textures";

const SPEED = 44; // 4x
const DASH_SPEED = 90; // 2x, added on top of current velocity
const MAX_HSPEED = 400;
const AIR_ACCEL = 60;
const GRAVITY = 60;
const JUMP_V = 28;
const EYE = 3.2;
const PLAYER_R = 0.8;
const BULLET_SPEED = 90;
const BOT_BULLET_SPEED = 45;
const MAX_B = 96;
const WALL_EPS = 0.5;

type Bullet = { pos: THREE.Vector3; vel: THREE.Vector3; life: number; alive: boolean; dmg: number };

function makePool(): Bullet[] {
  return Array.from({ length: MAX_B }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, alive: false, dmg: DMG }));
}
function spawn(pool: Bullet[], pos: THREE.Vector3, vel: THREE.Vector3, dmg = DMG) {
  const b = pool.find((x) => !x.alive);
  if (!b) return;
  b.pos.copy(pos);
  b.vel.copy(vel);
  b.life = 10;
  b.dmg = dmg;
  b.alive = true;
}

function collide(p: THREE.Vector3, r: number) {
  const hw = ROOM.w / 2 - r, hd = ROOM.d / 2 - r;
  p.x = THREE.MathUtils.clamp(p.x, -hw, hw);
  p.z = THREE.MathUtils.clamp(p.z, -hd, hd);
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const ox = o.hw + r - Math.abs(dx), oz = o.hd + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) p.x += Math.sign(dx) * ox;
      else p.z += Math.sign(dz) * oz;
    }
  }
}

/** Returns the outward normal of a wall the player is touching, or null. */
function wallNormal(p: THREE.Vector3, r: number): THREE.Vector3 | null {
  const hw = ROOM.w / 2 - r, hd = ROOM.d / 2 - r;
  if (p.x >= hw - WALL_EPS) return new THREE.Vector3(-1, 0, 0);
  if (p.x <= -hw + WALL_EPS) return new THREE.Vector3(1, 0, 0);
  if (p.z >= hd - WALL_EPS) return new THREE.Vector3(0, 0, -1);
  if (p.z <= -hd + WALL_EPS) return new THREE.Vector3(0, 0, 1);
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const ox = o.hw + r + WALL_EPS - Math.abs(dx), oz = o.hd + r + WALL_EPS - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      return ox < oz ? new THREE.Vector3(Math.sign(dx) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz) || 1);
    }
  }
  return null;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const zAxis = new THREE.Vector3(0, 0, 1);
const START = new THREE.Vector3(0, 0, 120);
const BOT_START = new THREE.Vector3(0, 0, -100);

export function World() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const pos = useRef(START.clone()); // feet position
  const hv = useRef(new THREE.Vector3()); // horizontal velocity
  const vy = useRef(0);
  const grounded = useRef(true);
  const fireT = useRef(0);
  const playerPool = useMemo(makePool, []);
  const botPool = useMemo(makePool, []);
  const pInst = useRef<THREE.InstancedMesh>(null);
  const bInst = useRef<THREE.InstancedMesh>(null);
  const bot = useRef<THREE.Group>(null);
  const botState = useRef({
    target: new THREE.Vector3(0, 0, -100), shootT: 1, bob: 0,
    y: 0, vy: 0, jumpT: 2, jumpsLeft: 0, dashT: 3, dash: new THREE.Vector3(),
  });
  const parryMesh = useRef<THREE.Mesh>(null);
  const wood = useMemo(tableWood, []);
  const lastReset = useRef(-1);

  useEffect(() => {
    const camDirs = () => {
      const f = new THREE.Vector3();
      camera.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      return { f, r: new THREE.Vector3(-f.z, 0, f.x) };
    };
    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
      const wasDown = keys.current[e.code];
      keys.current[e.code] = true;
      if (G.phase !== "playing" || wasDown || e.repeat) return;
      if (e.code === "KeyE" && G.parryCd <= 0) {
        G.parryWin = PARRY_WINDOW;
        G.parryCd = PARRY_CD;
      }
      if (e.code === "Space" && !grounded.current && !G.wallrun) {
        // prefer wallrun if touching a wall, else air jump
        if (!wallNormal(pos.current, PLAYER_R) && G.airJumps > 0) {
          G.airJumps--;
          vy.current = JUMP_V;
        }
      }
      if (e.code === "KeyQ" && !G.wallrun) {
        const canDash = grounded.current ? G.dashCd <= 0 : G.airDashes > 0;
        if (canDash) {
          const { f, r } = camDirs();
          const d = new THREE.Vector3();
          if (keys.current["KeyW"]) d.add(f);
          if (keys.current["KeyS"]) d.sub(f);
          if (keys.current["KeyD"]) d.add(r);
          if (keys.current["KeyA"]) d.sub(r);
          if (d.lengthSq() === 0) d.copy(f);
          hv.current.addScaledVector(d.normalize(), DASH_SPEED);
          if (hv.current.length() > MAX_HSPEED) hv.current.setLength(MAX_HSPEED);
          if (grounded.current) {
            G.dashCd = DASH_CD;
          } else {
            G.airDashes--;
            if (vy.current < 0) vy.current = 0;
          }
        }
      }
      if (e.code === "KeyR" && G.ammo < MAG && G.reloading <= 0) G.reloading = 1.5;
    };
    const ku = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const md = (e: MouseEvent) => {
      if (e.button === 0) G.firing = true;
      if (e.button === 2) G.scoped = true;
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) G.firing = false;
      if (e.button === 2) G.scoped = false;
    };
    const cm = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    window.addEventListener("contextmenu", cm);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("contextmenu", cm);
    };
  }, [camera]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    const p = pos.current;
    const bs = botState.current;

    if (lastReset.current !== G.resetToken) {
      lastReset.current = G.resetToken;
      p.copy(START);
      hv.current.set(0, 0, 0);
      vy.current = 0;
      grounded.current = true;
      cam.position.set(p.x, EYE, p.z);
      cam.lookAt(0, EYE, -100);
      playerPool.forEach((b) => (b.alive = false));
      botPool.forEach((b) => (b.alive = false));
      bot.current?.position.copy(BOT_START);
      bs.y = 0;
      bs.vy = 0;
      bs.dash.set(0, 0, 0);
    }

    const targetFov = G.scoped ? 28 : 80;
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-14 * dt));
    cam.updateProjectionMatrix();

    const playing = G.phase === "playing";
    G.hitFlash = Math.max(0, G.hitFlash - dt);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);
    G.parryFlash = Math.max(0, G.parryFlash - dt);

    if (playing) {
      G.parryWin = Math.max(0, G.parryWin - dt);
      G.parryCd = Math.max(0, G.parryCd - dt);
      G.buff = Math.max(0, G.buff - dt);
      G.dashCd = Math.max(0, G.dashCd - dt);

      const f = new THREE.Vector3();
      cam.getWorldDirection(f);
      f.y = 0;
      f.normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const wish = new THREE.Vector3();
      const k = keys.current;
      if (k["KeyW"]) wish.add(f);
      if (k["KeyS"]) wish.sub(f);
      if (k["KeyD"]) wish.add(r);
      if (k["KeyA"]) wish.sub(r);
      if (wish.lengthSq()) wish.normalize();
      const space = !!k["Space"];
      const v = hv.current;

      // --- wallrun: locked in until space is released ---
      if (G.wallrun) {
        const n = space ? wallNormal(p, PLAYER_R) : null;
        if (!n) {
          G.wallrun = false;
        } else {
          const spd = v.length();
          v.addScaledVector(n, -v.dot(n));
          if (v.lengthSq() > 1e-4) v.setLength(spd);
          vy.current = 0;
        }
      }

      if (!G.wallrun) {
        if (grounded.current) {
          if (space) {
            // jump / bunny hop: keep all horizontal velocity
            vy.current = JUMP_V;
            grounded.current = false;
          } else {
            const spd = G.scoped ? SPEED * 0.55 : SPEED;
            v.lerp(wish.clone().multiplyScalar(spd), 1 - Math.exp(-10 * dt));
          }
        } else {
          const prev = v.length();
          v.addScaledVector(wish, AIR_ACCEL * dt);
          const cap = Math.max(prev, SPEED);
          if (v.length() > cap) v.setLength(cap);
          vy.current -= GRAVITY * dt;
          if (space && wallNormal(p, PLAYER_R)) {
            G.wallrun = true;
            vy.current = 0;
          }
        }
      }

      p.addScaledVector(v, dt);
      p.y += vy.current * dt;
      collide(p, PLAYER_R);
      if (p.y <= 0) {
        p.y = 0;
        if (!grounded.current) {
          grounded.current = true;
          G.wallrun = false;
          G.airJumps = AIR_JUMPS;
          G.airDashes = AIR_DASHES;
        }
        if (vy.current < 0) vy.current = 0;
      } else if (vy.current > 0 || G.wallrun) {
        grounded.current = false;
      }
      if (p.y > ROOM.h - EYE - 1) {
        p.y = ROOM.h - EYE - 1;
        if (vy.current > 0) vy.current = 0;
      }
      G.speed = v.length();
      cam.position.set(p.x, p.y + EYE, p.z);

      // reload / fire
      if (G.reloading > 0) {
        G.reloading -= dt;
        if (G.reloading <= 0) {
          G.reloading = 0;
          G.ammo = MAG;
        }
      }
      fireT.current -= dt;
      const buffed = G.buff > 0;
      if (G.firing && G.ammo > 0 && G.reloading <= 0 && fireT.current <= 0) {
        fireT.current = buffed ? FIRE_INTERVAL / 2 : FIRE_INTERVAL;
        G.ammo--;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const spread = G.scoped ? 0.004 : 0.025;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        const start = cam.position.clone().addScaledVector(dir, 1).add(new THREE.Vector3(0, -0.3, 0));
        spawn(playerPool, start, dir.multiplyScalar(BULLET_SPEED), buffed ? DMG * 2 : DMG);
        if (G.ammo === 0) G.reloading = 1.5;
      }
    }

    // --- bot table ---
    const scale = 0.3 + 0.7 * (G.botHp / 100);
    if (bot.current) {
      const bp = bot.current.position;
      if (playing) {
        const speed = (5 + (1 - G.botHp / 100) * 9) * 4;
        const toT = bs.target.clone().sub(bp);
        toT.y = 0;
        if (toT.length() < 4) {
          const m = 60;
          bs.target.set((Math.random() - 0.5) * (ROOM.w - m), 0, (Math.random() - 0.5) * (ROOM.d - m));
        } else {
          bp.addScaledVector(toT.normalize(), speed * dt);
        }
        // dash
        bs.dashT -= dt;
        if (bs.dashT <= 0) {
          bs.dashT = 2.5 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          bs.dash.set(Math.cos(a), 0, Math.sin(a)).multiplyScalar(90);
        }
        bp.addScaledVector(bs.dash, dt);
        bs.dash.multiplyScalar(Math.exp(-3 * dt));
        // jumps (a few in a row)
        bs.jumpT -= dt;
        if (bs.jumpT <= 0 && bs.y <= 0) {
          bs.jumpsLeft = 1 + Math.floor(Math.random() * 3);
          bs.jumpT = 3 + Math.random() * 3;
        }
        if (bs.jumpsLeft > 0 && (bs.y <= 0 || bs.vy < 0)) {
          bs.vy = JUMP_V;
          bs.jumpsLeft--;
        }
        bs.vy -= GRAVITY * dt;
        bs.y = Math.max(0, bs.y + bs.vy * dt);
        if (bs.y <= 0 && bs.vy < 0) bs.vy = 0;

        collide(bp, 3 * scale);
        bs.bob += dt * speed * 0.35;
        bot.current.rotation.y = Math.atan2(cam.position.x - bp.x, cam.position.z - bp.z);
        // shoot (2x faster)
        bs.shootT -= dt;
        if (bs.shootT <= 0) {
          bs.shootT = 0.45 + Math.random() * 0.4;
          const from = bp.clone().add(new THREE.Vector3(0, 3.2 * scale, 0));
          const aim = cam.position.clone().add(new THREE.Vector3(0, -0.5, 0)).sub(from).normalize();
          aim.x += (Math.random() - 0.5) * 0.05;
          aim.y += (Math.random() - 0.5) * 0.03;
          spawn(botPool, from, aim.normalize().multiplyScalar(BOT_BULLET_SPEED));
        }
      }
      const s = THREE.MathUtils.lerp(bot.current.scale.x, scale, 1 - Math.exp(-8 * dt));
      bot.current.scale.setScalar(s);
      bp.y = bs.y + (bs.y <= 0 ? Math.abs(Math.sin(bs.bob)) * 0.4 * s : 0);
      bot.current.visible = G.phase !== "won";
    }

    // --- bullets ---
    const botCenter = bot.current ? bot.current.position.clone().add(new THREE.Vector3(0, 2.6 * scale, 0)) : new THREE.Vector3();
    const botR = 3.2 * scale;
    const step = (pool: Bullet[], inst: THREE.InstancedMesh | null, isPlayer: boolean) => {
      let n = 0;
      for (const b of pool) {
        if (!b.alive) continue;
        b.pos.addScaledVector(b.vel, dt);
        b.life -= dt;
        const outside = Math.abs(b.pos.x) > ROOM.w / 2 || Math.abs(b.pos.z) > ROOM.d / 2 || b.pos.y < 0 || b.pos.y > ROOM.h;
        if (b.life <= 0 || outside) b.alive = false;
        else if (isPlayer && G.phase === "playing" && b.pos.distanceTo(botCenter) < botR) {
          b.alive = false;
          G.botHp = Math.max(0, G.botHp - b.dmg);
          G.hitFlash = 0.15;
          if (G.botHp <= 0) {
            G.phase = "won";
            document.exitPointerLock?.();
          }
        } else if (!isPlayer && G.phase === "playing") {
          const body = cam.position.clone().add(new THREE.Vector3(0, -1, 0));
          const dist = b.pos.distanceTo(body);
          if (G.parryWin > 0 && dist < 3) {
            // parry! send it back and power up
            b.alive = false;
            const back = botCenter.clone().sub(b.pos).normalize().multiplyScalar(BULLET_SPEED * 1.5);
            spawn(playerPool, b.pos, back, DMG * 2);
            G.parryWin = 0;
            G.buff = BUFF_TIME;
            G.parryFlash = 0.3;
          } else if (dist < 1.6) {
            b.alive = false;
            if (G.buff <= 0) {
              G.playerHp = Math.max(0, G.playerHp - b.dmg);
              G.hurtFlash = 0.25;
              if (G.playerHp <= 0) {
                G.phase = "lost";
                document.exitPointerLock?.();
              }
            }
          }
        }
        if (b.alive && inst) {
          tmpQ.setFromUnitVectors(zAxis, b.vel.clone().normalize());
          tmpM.compose(b.pos, tmpQ, tmpS);
          inst.setMatrixAt(n++, tmpM);
        }
      }
      if (inst) {
        inst.count = n;
        inst.instanceMatrix.needsUpdate = true;
      }
    };
    step(playerPool, pInst.current, true);
    step(botPool, bInst.current, false);

    if (parryMesh.current) {
      parryMesh.current.visible = G.parryWin > 0 || G.buff > 0;
      parryMesh.current.position.copy(cam.position);
    }
  });

  const legs: [number, number][] = [[-2.4, -1.5], [2.4, -1.5], [-2.4, 1.5], [2.4, 1.5]];

  return (
    <>
      <PointerLockControls selector="#play-btn" />
      <Room />
      <group ref={bot} position={BOT_START.toArray()}>
        <mesh position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial map={wood} color="#ffffff" roughness={0.6} />
        </mesh>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.5, z]} castShadow>
            <boxGeometry args={[0.45, 3, 0.45]} />
            <meshStandardMaterial map={wood} color="#d8b08a" />
          </mesh>
        ))}
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x, 3.2, 2.02]}>
            <boxGeometry args={[0.7, 0.25, 0.05]} />
            <meshStandardMaterial color="#1a0d05" />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={pInst} args={[undefined, undefined, MAX_B]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.07, 1.1]} />
        <meshStandardMaterial color="#e2b27a" emissive="#6b3d12" />
      </instancedMesh>
      <instancedMesh ref={bInst} args={[undefined, undefined, MAX_B]} frustumCulled={false}>
        <boxGeometry args={[0.14, 0.14, 1.4]} />
        <meshStandardMaterial color="#5a2e0e" emissive="#c2410c" emissiveIntensity={0.8} />
      </instancedMesh>
      <mesh ref={parryMesh} visible={false}>
        <sphereGeometry args={[2, 24, 16]} />
        <meshBasicMaterial color="#6fc3ff" transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
}
