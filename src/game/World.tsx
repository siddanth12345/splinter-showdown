import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { G, MAG, FIRE_INTERVAL, DMG, SHIELD_TIME, SHIELD_CD, DASH_CD } from "./state";
import { Room, ROOM, OBSTACLES } from "./Room";
import { tableWood } from "./textures";

const SPEED = 11;
const DASH_SPEED = 45;
const EYE = 3.2;
const PLAYER_R = 0.8;
const BULLET_SPEED = 70;
const BOT_BULLET_SPEED = 30;
const MAX_B = 64;

type Bullet = { pos: THREE.Vector3; vel: THREE.Vector3; life: number; alive: boolean };

function makePool(): Bullet[] {
  return Array.from({ length: MAX_B }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, alive: false }));
}
function spawn(pool: Bullet[], pos: THREE.Vector3, vel: THREE.Vector3) {
  const b = pool.find((x) => !x.alive);
  if (!b) return;
  b.pos.copy(pos);
  b.vel.copy(vel);
  b.life = 3;
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

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3(1, 1, 1);
const zAxis = new THREE.Vector3(0, 0, 1);

export function World() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const vel = useRef(new THREE.Vector3());
  const dashVel = useRef(new THREE.Vector3());
  const fireT = useRef(0);
  const playerPool = useMemo(makePool, []);
  const botPool = useMemo(makePool, []);
  const pInst = useRef<THREE.InstancedMesh>(null);
  const bInst = useRef<THREE.InstancedMesh>(null);
  const bot = useRef<THREE.Group>(null);
  const botState = useRef({ target: new THREE.Vector3(0, 0, -10), shootT: 1.5, bob: 0 });
  const shieldMesh = useRef<THREE.Mesh>(null);
  const wood = useMemo(tableWood, []);
  const lastReset = useRef(-1);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (G.phase !== "playing") return;
      if (e.code === "KeyE" && G.shieldCd <= 0) {
        G.shield = SHIELD_TIME;
        G.shieldCd = SHIELD_CD;
      }
      if (e.code === "KeyQ" && G.dashCd <= 0) {
        const f = new THREE.Vector3();
        camera.getWorldDirection(f);
        f.y = 0;
        f.normalize();
        const r = new THREE.Vector3(-f.z, 0, f.x);
        const d = new THREE.Vector3();
        if (keys.current["KeyW"]) d.add(f);
        if (keys.current["KeyS"]) d.sub(f);
        if (keys.current["KeyD"]) d.add(r);
        if (keys.current["KeyA"]) d.sub(r);
        if (d.lengthSq() === 0) d.copy(f);
        dashVel.current.copy(d.normalize().multiplyScalar(DASH_SPEED));
        G.dashCd = DASH_CD;
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

    if (lastReset.current !== G.resetToken) {
      lastReset.current = G.resetToken;
      cam.position.set(0, EYE, 12);
      cam.lookAt(0, EYE, -10);
      playerPool.forEach((b) => (b.alive = false));
      botPool.forEach((b) => (b.alive = false));
      bot.current?.position.set(0, 0, -10);
    }

    // scope zoom
    const targetFov = G.scoped ? 28 : 72;
    cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-14 * dt));
    cam.updateProjectionMatrix();

    const playing = G.phase === "playing";
    G.hitFlash = Math.max(0, G.hitFlash - dt);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);

    if (playing) {
      G.shield = Math.max(0, G.shield - dt);
      G.shieldCd = Math.max(0, G.shieldCd - dt);
      G.dashCd = Math.max(0, G.dashCd - dt);

      // movement (camera-relative)
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
      const spd = G.scoped ? SPEED * 0.55 : SPEED;
      vel.current.lerp(wish.multiplyScalar(spd), 1 - Math.exp(-12 * dt));
      dashVel.current.multiplyScalar(Math.exp(-6 * dt));
      cam.position.addScaledVector(vel.current, dt).addScaledVector(dashVel.current, dt);
      collide(cam.position, PLAYER_R);
      cam.position.y = EYE;

      // reload / fire
      if (G.reloading > 0) {
        G.reloading -= dt;
        if (G.reloading <= 0) {
          G.reloading = 0;
          G.ammo = MAG;
        }
      }
      fireT.current -= dt;
      if (G.firing && G.ammo > 0 && G.reloading <= 0 && fireT.current <= 0) {
        fireT.current = FIRE_INTERVAL;
        G.ammo--;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const spread = G.scoped ? 0.004 : 0.025;
        dir.x += (Math.random() - 0.5) * spread;
        dir.y += (Math.random() - 0.5) * spread;
        dir.z += (Math.random() - 0.5) * spread;
        dir.normalize();
        const start = cam.position.clone().addScaledVector(dir, 1).add(new THREE.Vector3(0, -0.3, 0));
        spawn(playerPool, start, dir.multiplyScalar(BULLET_SPEED));
        if (G.ammo === 0) G.reloading = 1.5;
      }
    }

    // bot table
    const scale = 0.3 + 0.7 * (G.botHp / 100);
    const bs = botState.current;
    if (bot.current) {
      const bp = bot.current.position;
      if (playing) {
        const speed = 5 + (1 - G.botHp / 100) * 9; // faster as it shrinks
        const toT = bs.target.clone().sub(bp);
        toT.y = 0;
        if (toT.length() < 1) {
          bs.target.set((Math.random() - 0.5) * (ROOM.w - 12), 0, (Math.random() - 0.5) * (ROOM.d - 12));
        } else {
          bp.addScaledVector(toT.normalize(), speed * dt);
        }
        collide(bp, 3 * scale);
        bs.bob += dt * speed * 1.4;
        // face player
        const ang = Math.atan2(cam.position.x - bp.x, cam.position.z - bp.z);
        bot.current.rotation.y = ang;
        // shoot
        bs.shootT -= dt;
        if (bs.shootT <= 0) {
          bs.shootT = 0.9 + Math.random() * 0.8;
          const from = bp.clone().add(new THREE.Vector3(0, 3.2 * scale, 0));
          const aim = cam.position.clone().add(new THREE.Vector3(0, -0.5, 0)).sub(from).normalize();
          aim.x += (Math.random() - 0.5) * 0.06;
          aim.y += (Math.random() - 0.5) * 0.04;
          spawn(botPool, from, aim.normalize().multiplyScalar(BOT_BULLET_SPEED));
        }
      }
      const s = THREE.MathUtils.lerp(bot.current.scale.x, scale, 1 - Math.exp(-8 * dt));
      bot.current.scale.setScalar(s);
      bp.y = Math.abs(Math.sin(bs.bob)) * 0.4 * s;
      bot.current.visible = G.phase !== "won";
    }

    // bullets
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
          G.botHp = Math.max(0, G.botHp - DMG);
          G.hitFlash = 0.15;
          if (G.botHp <= 0) {
            G.phase = "won";
            document.exitPointerLock?.();
          }
        } else if (!isPlayer && G.phase === "playing") {
          const dx = b.pos.x - cam.position.x, dz = b.pos.z - cam.position.z;
          if (Math.hypot(dx, dz) < (G.shield > 0 ? 2 : 0.9) && Math.abs(b.pos.y - (EYE - 1)) < 2.2) {
            b.alive = false;
            if (G.shield <= 0) {
              G.playerHp = Math.max(0, G.playerHp - DMG);
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

    if (shieldMesh.current) {
      shieldMesh.current.visible = G.shield > 0;
      shieldMesh.current.position.copy(cam.position);
    }
  });

  const legs: [number, number][] = [[-2.4, -1.5], [2.4, -1.5], [-2.4, 1.5], [2.4, 1.5]];

  return (
    <>
      <PointerLockControls selector="#play-btn" />
      <Room />
      <group ref={bot} position={[0, 0, -10]}>
        <mesh position={[0, 3.2, 0]} castShadow>
          <boxGeometry args={[6, 0.5, 4]} />
          <meshStandardMaterial map={wood} color="#ffffff" emissive="#ff3b1f" emissiveIntensity={0} roughness={0.6} />
        </mesh>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.5, z]} castShadow>
            <boxGeometry args={[0.45, 3, 0.45]} />
            <meshStandardMaterial map={wood} color="#d8b08a" />
          </mesh>
        ))}
        {/* angry eyes on the front edge */}
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
      <mesh ref={shieldMesh} visible={false}>
        <sphereGeometry args={[2, 24, 16]} />
        <meshBasicMaterial color="#6fc3ff" transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
}
