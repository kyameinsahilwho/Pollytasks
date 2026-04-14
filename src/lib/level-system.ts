
export const XP_PER_TASK = 10;
export const XP_PER_NOTE = 5;
export const XP_PER_RITUAL = 15;
export const STREAK_XP_BONUS = 2; // Extra XP per day of streak (capped)
export const MAX_STREAK_BONUS = 20;
export const BASE_XP_REQUIREMENT = 100;
export const XP_INCREMENT = 20;
export const MAX_INCREMENT_LEVEL = 100;

export function getXPForLevel(level: number): number {
  // Returns the XP required to go from level -> level + 1
  // Level 1 -> 2: 100
  // Level 2 -> 3: 120
  // ...
  // Level 100 -> 101: 100 + (99 * 20) = 2080
  // Level 101 -> 102: 2080 (capped increment)
  
  const effectiveLevel = Math.min(level, MAX_INCREMENT_LEVEL);
  return BASE_XP_REQUIREMENT + (effectiveLevel - 1) * XP_INCREMENT;
}

export interface LevelInfo {
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progress: number;
  totalXP: number;
}

export function calculateLevel(totalXP: number): LevelInfo {
  let level = 1;
  let remainingXP = totalXP;
  let xpForNext = getXPForLevel(level);

  while (remainingXP >= xpForNext) {
    remainingXP -= xpForNext;
    level++;
    xpForNext = getXPForLevel(level);
  }

  return {
    level,
    currentLevelXP: remainingXP,
    nextLevelXP: xpForNext,
    progress: (remainingXP / xpForNext) * 100,
    totalXP
  };
}
