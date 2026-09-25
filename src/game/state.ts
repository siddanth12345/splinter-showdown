export const MAG = 24;
export const FIRE_INTERVAL = 5 / 24; // 24 splinters in 5s
export const DMG = 5;
export const PARRY_WINDOW = 0.1;
export const PARRY_CD = 3;
export const BUFF_TIME = 3;
export const DASH_CD = 2;
export const AIR_JUMPS = 2; // + 1 from the ground = 3
export const AIR_DASHES = 4;

export type Phase = "menu" | "playing" | "won" | "lost";

export const G = {
  phase: "menu" as Phase,
  playerHp: 100,
  botHp: 100,
  ammo: MAG,
  reloading: 0,
  parryWin: 0,
  parryCd: 0,
  buff: 0,
  dashCd: 0,
  airJumps: AIR_JUMPS,
  airDashes: AIR_DASHES,
  wallrun: false,
  speed: 0,
  scoped: false,
  firing: false,
  hitFlash: 0,
  hurtFlash: 0,
  parryFlash: 0,
  resetToken: 0,
};

export function resetGame() {
  G.playerHp = 100;
  G.botHp = 100;
  G.ammo = MAG;
  G.reloading = 0;
  G.parryWin = 0;
  G.parryCd = 0;
  G.buff = 0;
  G.dashCd = 0;
  G.airJumps = AIR_JUMPS;
  G.airDashes = AIR_DASHES;
  G.wallrun = false;
  G.hitFlash = 0;
  G.hurtFlash = 0;
  G.parryFlash = 0;
  G.resetToken++;
  G.phase = "playing";
}
