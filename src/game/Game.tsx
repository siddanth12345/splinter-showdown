import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect, useState } from "react";
import { World } from "./World";
import { G, MAG, PARRY_CD, DASH_CD, BOMB_CD, TABLE_CAP, BOSS_HITS, resetGame, lockPointer, MAP } from "./state";
import { ROOM, SOLIDS } from "./Room";

function useTick(ms: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Bar({ label, value, max = 100, tone, right }: { label: string; value: number; max?: number; tone: string; right?: string }) {
  return (
    <div className="w-64">
      <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-widest">
        <span>{label}</span>
        <span>{right ?? Math.ceil(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm bg-hud-track">
        <div className="h-full transition-all" style={{ width: `${(value / max) * 100}%`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

function MiniMap() {
  const R = ROOM.r;
  const dot = (x: number, z: number, c: string, r: number, k: string) => <circle key={k} cx={x} cy={z} r={r} fill={c} stroke="#000" strokeWidth={2} />;
  const t: React.ReactNode[] = [];
  for (let i = 0; i < MAP.tables.length; i += 2) t.push(dot(MAP.tables[i]!, MAP.tables[i + 1]!, "#22c55e", 7, "t" + i));
  for (let i = 0; i < MAP.blues.length; i += 2) t.push(dot(MAP.blues[i]!, MAP.blues[i + 1]!, "#60a5fa", 6, "u" + i));
  const hx = MAP.px - Math.sin(MAP.yaw) * 30, hz = MAP.pz - Math.cos(MAP.yaw) * 30;
  return (
    <div className="absolute right-6 top-6 rounded-full bg-hud-panel p-2">
      <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="h-52 w-52">
        <circle cx={0} cy={0} r={R - 2} fill="#e8dcc4" fillOpacity={0.25} stroke="currentColor" strokeWidth={4} />
        {SOLIDS.map((s, i) => (
          <rect key={i} x={s.x - s.hw} y={s.z - s.hd} width={s.hw * 2} height={s.hd * 2} fill="#8a6a4a" fillOpacity={0.8} />
        ))}
        {t}
        {MAP.boss && dot(MAP.boss.x, MAP.boss.z, "#ef4444", 16, "boss")}
        <line x1={MAP.px} y1={MAP.pz} x2={hx} y2={hz} stroke="#1d4ed8" strokeWidth={5} />
        {dot(MAP.px, MAP.pz, "#1d4ed8", 9, "me")}
      </svg>
    </div>
  );
}

function HUD() {
  useTick(50);
  const playing = G.phase === "playing";
  if (G.phase === "won") return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono text-hud">
      {G.hurtFlash > 0 && <div className="absolute inset-0 bg-destructive/25" />}
      {G.redFlash > 0 && <div className="absolute inset-0 bg-destructive/40" />}
      {(G.buff > 0 || G.parryFlash > 0) && <div className="absolute inset-0 shadow-[inset_0_0_120px_var(--shield)]" />}
      {G.scoped && playing && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_32%,var(--scope)_34%)]" />}

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

      <MiniMap />
      <div className="absolute left-6 top-6 space-y-2 rounded bg-hud-panel p-3 text-xs font-bold uppercase tracking-widest">
        {G.stage === "tables" && (
          <>
            <div>Tables alive: {G.alive}{G.capReached ? " — clear them all!" : ` / ${TABLE_CAP}`}</div>
            <div className="opacity-70">Kills: {G.kills}</div>
          </>
        )}
        {G.stage === "incoming" && <div className="text-destructive">Boss incoming — {Math.ceil(G.bossWarn)}s</div>}
        {G.stage === "boss" && <Bar label="Boss Table" value={BOSS_HITS - G.bossHits} max={BOSS_HITS} tone="enemy" right={`${BOSS_HITS - G.bossHits} hits`} />}
      </div>
      {G.stage === "incoming" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-destructive/80 px-6 py-3 text-center text-destructive-foreground">
          <div className="text-2xl font-black uppercase">Stay away from the center!</div>
          <div className="mx-auto mt-2 h-2 w-72 bg-hud-track">
            <div className="h-full bg-destructive-foreground" style={{ width: `${(G.bossWarn / 10) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 space-y-3 rounded bg-hud-panel p-3">
        <Bar label="Your Health" value={G.playerHp} tone="crosshair" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-widest">
          <span className={G.buff > 0 ? "text-shield" : ""}>
            [E] Parry {G.buff > 0 ? `POWER ${G.buff.toFixed(1)}s` : G.parryWin > 0 ? "ACTIVE" : G.parryCd > 0 ? G.parryCd.toFixed(1) : "ready"}
          </span>
          <span>[Q] Dash {G.dashCd > 0 ? G.dashCd.toFixed(1) : "ready"}</span>
          <span>[F] Bomb {G.bombCd > 0 ? G.bombCd.toFixed(1) : "ready"}</span>
          <span className={G.grappling ? "text-shield" : ""}>[C] Grapple</span>
        </div>
        <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
          <span>Air jumps {G.airJumps}</span>
          <span>Air dashes {G.airDashes}</span>
          <span>{Math.round(G.speed)} u/s</span>
          {G.wallrun && <span className="text-shield">Wallrun</span>}
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-shield" style={{ width: `${(1 - G.parryCd / PARRY_CD) * 100}%` }} />
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-hud" style={{ width: `${(1 - G.dashCd / DASH_CD) * 100}%` }} />
        </div>
        <div className="h-1 w-64 bg-hud-track">
          <div className="h-full bg-enemy" style={{ width: `${Math.min(1, 1 - G.bombCd / BOMB_CD) * 100}%` }} />
        </div>
      </div>
      <div className="absolute bottom-6 right-6 rounded bg-hud-panel p-3 text-right">
        <div className="text-xs uppercase tracking-widest opacity-70">Splinters</div>
        <div className="text-4xl font-black">
          {G.buff > 0 ? "∞" : G.reloading > 0 ? "RELOADING" : `${G.ammo} / ${MAG}`}
        </div>
      </div>
    </div>
  );
}

function start(restart: boolean) {
  if (restart || G.phase !== "playing") resetGame();
  lockPointer();
}

function Menu() {
  useTick(100);
  const phase = G.phase;
  if (phase === "won" || (phase === "playing" && G.locked)) return null;
  const paused = phase === "playing";
  const title = phase === "lost" ? "You Got Splintered" : paused ? "Paused" : "Table Wars";
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-hud-scrim font-mono text-hud">
      <div className="max-w-lg rounded-lg border-2 border-hud/30 bg-hud-panel p-8 text-center">
        <h1 className="text-5xl font-black tracking-tight">{title}</h1>
        <p className="mt-3 text-sm opacity-80">
          Every table you break brings two more — up to 30. Clear them all, then survive the red boss.
        </p>
        <ul className="mt-5 space-y-1 text-left text-sm">
          <li><b>WASD</b> move · <b>Mouse</b> look · <b>Space</b> jump ×3 / hold to hop or wallrun</li>
          <li><b>Left click</b> shoot · <b>Right click</b> scope · <b>R</b> reload</li>
          <li><b>Q</b> dash · <b>E</b> parry · <b>F</b> bomb · hold <b>C</b> grapple</li>
        </ul>
        <div className="mt-6 flex justify-center gap-3">
          <button
            className="pointer-events-auto rounded bg-crosshair px-8 py-3 text-lg font-black uppercase text-hud-ink"
            onClick={() => start(false)}
          >
            {paused ? "Resume" : phase === "menu" ? "Play" : "Play Again"}
          </button>
          {paused && (
            <button
              className="pointer-events-auto rounded border-2 border-hud/40 px-8 py-3 text-lg font-black uppercase"
              onClick={() => start(true)}
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WinScreen() {
  useTick(200);
  if (G.phase !== "won") return null;
  const acc = G.shots ? (G.hits / G.shots) * 100 : 0;
  const m = Math.floor(G.time / 60), s = Math.floor(G.time % 60);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-hud-scrim font-mono text-hud">
      <div className="flex max-w-3xl items-center gap-10 rounded-lg border-2 border-hud/30 bg-hud-panel p-10">
        <div className="flex h-56 w-56 items-end justify-center">
          <div className="animate-bounce">
            <div className="relative h-8 w-40 rounded-sm bg-[var(--enemy)]">
              <div className="absolute left-8 top-1.5 h-4 w-4 rounded-full bg-hud"><div className="ml-1.5 mt-1.5 h-2 w-2 rounded-full bg-hud-ink" /></div>
              <div className="absolute right-8 top-1.5 h-4 w-4 rounded-full bg-hud"><div className="ml-1.5 mt-1.5 h-2 w-2 rounded-full bg-hud-ink" /></div>
            </div>
            <div className="flex justify-between px-3">
              <div className="h-16 w-3 bg-[var(--enemy)]" />
              <div className="h-16 w-3 bg-[var(--enemy)]" />
            </div>
          </div>
        </div>
        <div className="min-w-64">
          <h1 className="text-5xl font-black tracking-tight">Victory!</h1>
          <p className="mt-2 text-sm opacity-80">All 30 tables and the red boss are splinters.</p>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-lg">
            <dt className="opacity-70">Bullets shot</dt><dd className="text-right font-black">{G.shots}</dd>
            <dt className="opacity-70">Bullets hit</dt><dd className="text-right font-black">{G.hits}</dd>
            <dt className="opacity-70">Accuracy</dt><dd className="text-right font-black">{acc.toFixed(1)}%</dd>
            <dt className="opacity-70">Time taken</dt><dd className="text-right font-black">{m}:{s.toString().padStart(2, "0")}</dd>
          </dl>
          <button
            className="pointer-events-auto mt-8 rounded bg-crosshair px-8 py-3 text-lg font-black uppercase text-hud-ink"
            onClick={() => start(true)}
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}

export function Game() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 3.2, 12], fov: 72, near: 0.1, far: 3000 }}>
        <color attach="background" args={["#e8dcc4"]} />
        <fog attach="fog" args={["#e8dcc4", 250, 1400]} />
        <ambientLight intensity={0.7} color="#ffe8c8" />
        <directionalLight
          position={[-120, 500, -180]}
          intensity={1.8}
          color="#fff2d8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-360}
          shadow-camera-right={360}
          shadow-camera-top={360}
          shadow-camera-bottom={-360}
          shadow-camera-far={1500}
        />
        <Environment>
          <Lightformer intensity={1.5} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[30, 20, 1]} color="#fff1dc" />
          <Lightformer intensity={1} position={[0, 6, -20]} scale={[20, 6, 1]} color="#cfe6ff" />
        </Environment>
        <World />
      </Canvas>
      <HUD />
      <Menu />
      <WinScreen />
    </div>
  );
}
