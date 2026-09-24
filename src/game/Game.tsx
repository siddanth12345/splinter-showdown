import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useState } from "react";
import { World } from "./World";
import { G, MAG, SHIELD_CD, DASH_CD, resetGame } from "./state";

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="w-64">
      <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest">
        <span>{label}</span>
        <span>{Math.ceil(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm bg-hud-track">
        <div className="h-full transition-all" style={{ width: `${value}%`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

function HUD() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, []);
  const playing = G.phase === "playing";
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-hud">
      {G.hurtFlash > 0 && <div className="absolute inset-0 bg-destructive/25" />}
      {G.shield > 0 && <div className="absolute inset-0 shadow-[inset_0_0_120px_var(--shield)]" />}
      {G.scoped && playing && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_32%,var(--scope)_34%)]" />}

      {/* crosshair */}
      {playing && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 bg-crosshair" />
            <div className="absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-crosshair" />
            <div className="absolute left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-crosshair" />
            <div className="absolute right-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-crosshair" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-crosshair" />
            {G.hitFlash > 0 && <div className="absolute -inset-2 rotate-45 border-2 border-crosshair" />}
          </div>
        </div>
      )}

      <div className="absolute left-6 top-6 rounded bg-hud-panel p-3">
        <Bar label="Enemy Table" value={G.botHp} tone="enemy" />
      </div>
      <div className="absolute bottom-6 left-6 space-y-3 rounded bg-hud-panel p-3">
        <Bar label="Your Health" value={G.playerHp} tone="crosshair" />
        <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
          <span className={G.shield > 0 ? "text-shield" : ""}>
            [E] Shield {G.shield > 0 ? `${G.shield.toFixed(1)}s` : G.shieldCd > 0 ? `${(G.shieldCd).toFixed(1)}` : "ready"}
          </span>
          <span>[Q] Dash {G.dashCd > 0 ? G.dashCd.toFixed(1) : "ready"}</span>
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-shield" style={{ width: `${(1 - G.shieldCd / SHIELD_CD) * 100}%` }} />
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-hud" style={{ width: `${(1 - G.dashCd / DASH_CD) * 100}%` }} />
        </div>
      </div>
      <div className="absolute bottom-6 right-6 rounded bg-hud-panel p-3 text-right">
        <div className="text-xs uppercase tracking-widest opacity-70">Splinters</div>
        <div className="text-4xl font-black">
          {G.reloading > 0 ? "RELOADING" : `${G.ammo} / ${MAG}`}
        </div>
      </div>
    </div>
  );
}

function Menu() {
  const [phase, setPhase] = useState(G.phase);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setPhase(G.phase), 100);
    const onLock = () => setLocked(!!document.pointerLockElement);
    document.addEventListener("pointerlockchange", onLock);
    return () => {
      clearInterval(id);
      document.removeEventListener("pointerlockchange", onLock);
    };
  }, []);
  if (phase === "playing" && locked) return null;
  const title =
    phase === "won" ? "Table Destroyed!" : phase === "lost" ? "You Got Splintered" : phase === "playing" ? "Paused" : "Table Wars";
  const btn = phase === "playing" ? "Resume" : phase === "menu" ? "Play" : "Play Again";
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim font-mono text-hud">
      <div className="max-w-md rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className="text-5xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-sm opacity-80">
          Blast the living table with splinters. Every hit shrinks it — and makes it faster.
        </p>
        <ul className="mt-5 space-y-1 text-left text-sm">
          <li><b>WASD</b> move · <b>Mouse</b> look</li>
          <li><b>Left click</b> shoot (24 splinters / 5s) · <b>Right click</b> scope</li>
          <li><b>Q</b> dash · <b>E</b> shield (4s) · <b>R</b> reload</li>
        </ul>
        <button
          id="play-btn"
          className="pointer-events-auto mt-6 rounded bg-crosshair px-8 py-3 text-lg font-black uppercase text-hud-ink"
          onClick={() => {
            if (G.phase !== "playing") resetGame();
            setPhase(G.phase);
          }}
        >
          {btn}
        </button>
      </div>
    </div>
  );
}

export function Game() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 3.2, 12], fov: 72, near: 0.1 }}>
        <color attach="background" args={["#e8dcc4"]} />
        <fog attach="fog" args={["#e8dcc4", 40, 90]} />
        <ambientLight intensity={0.45} color="#ffe8c8" />
        <directionalLight
          position={[-12, 20, -18]}
          intensity={1.8}
          color="#fff2d8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-32}
          shadow-camera-right={32}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
        <Environment>
          <Lightformer intensity={1.5} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[30, 20, 1]} color="#fff1dc" />
          <Lightformer intensity={1} position={[0, 6, -20]} scale={[20, 6, 1]} color="#cfe6ff" />
        </Environment>
        <World />
      </Canvas>
      <HUD />
      <Menu />
    </div>
  );
}
