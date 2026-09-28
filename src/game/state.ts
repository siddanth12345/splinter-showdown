export const MAG = 40;
export const FIRE_INTERVAL = 5 / 24; // 24 splinters in 5s
export const DMG = 5;
export const PARRY_WINDOW = 1;
export const PARRY_CD = 5;
export const BUFF_TIME = 6;
export const DASH_CD = 2;
export const AIR_JUMPS = 2; // + 1 from the ground = 3
export const AIR_DASHES = 4;
export const BOMB_CD = 3;
export const BOMB_CD_BUFF = 2;
export const TABLE_HP = 10;
export const TABLE_CAP = 30;
export const BOSS_HITS = 200;
export const BOSS_WARN = 10;

export type Phase = "menu" | "playing" | "won" | "lost";
export type Stage = "tables" | "incoming" | "boss";

export const G = {
  phase: "menu" as Phase,
  stage: "tables" as Stage,
  locked: false,
  playerHp: 100,
  ammo: MAG,
  reloading: 0,
  parryWin: 0,
  parryCd: 0,
  buff: 0,
  dashCd: 0,
  bombCd: 0,
  airJumps: AIR_JUMPS,
  airDashes: AIR_DASHES,
  wallrun: false,
  grappling: false,
  speed: 0,
  scoped: false,
  firing: false,
  hitFlash: 0,
  hurtFlash: 0,
  parryFlash: 0,
  redFlash: 0,
  shake: 0,
  alive: 1,
  kills: 0,
  capReached: false,
  bossWarn: 0,
  bossHits: 0,
  shots: 0,
  hits: 0,
  time: 0,
  resetToken: 0,
};

export function resetGame() {
  Object.assign(G, {
    stage: "tables", playerHp: 100, ammo: MAG, reloading: 0, parryWin: 0, parryCd: 0, buff: 0,
    dashCd: 0, bombCd: 0, airJumps: AIR_JUMPS, airDashes: AIR_DASHES, wallrun: false, grappling: false,
    hitFlash: 0, hurtFlash: 0, parryFlash: 0, redFlash: 0, shake: 0, alive: 1, kills: 0, capReached: false,
    bossWarn: 0, bossHits: 0, shots: 0, hits: 0, time: 0, firing: false, scoped: false,
  });
  G.resetToken++;
  G.phase = "playing";
}

// Pointer lock is requested directly from button clicks so Resume/Restart always work.
let lockFn: (() => void) | null = null;
export function setLocker(fn: (() => void) | null) {
  lockFn = fn;
}
export function lockPointer() {
  try {
    lockFn?.();
  } catch {
    /* browser may refuse right after Esc; user can click again */
  }
}

// Minimap snapshot, written by World each frame, read by the HUD.
export const MAP = { px: 0, pz: 0, yaw: 0, boss: null as null | { x: number; z: number }, tables: [] as number[], blues: [] as number[] };
