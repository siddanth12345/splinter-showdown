export const MAG = 24;
export const FIRE_INTERVAL = 5 / 24; // 24 splinters in 5s
export const DMG = 5;
export const SHIELD_TIME = 4;
export const SHIELD_CD = 8;
export const DASH_CD = 2;

export type Phase = "menu" | "playing" | "won" | "lost";

export const G = {
  phase: "menu" as Phase,
  playerHp: 100,
  botHp: 100,
  ammo: MAG,
  reloading: 0,
  shield: 0,
  shieldCd: 0,
  dashCd: 0,
  scoped: false,
  firing: false,
  hitFlash: 0,
  hurtFlash: 0,
  resetToken: 0,
};

export function resetGame() {
  G.playerHp = 100;
  G.botHp = 100;
  G.ammo = MAG;
  G.reloading = 0;
  G.shield = 0;
  G.shieldCd = 0;
  G.dashCd = 0;
  G.hitFlash = 0;
  G.hurtFlash = 0;
  G.resetToken++;
  G.phase = "playing";
}
