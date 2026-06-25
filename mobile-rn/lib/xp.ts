/**
 * XP/Level calculation system for OFTA.
 * Each level requires progressively more XP.
 * Level N needs: 500 + (N-1) * 100 XP
 */

export interface LevelInfo {
  level: number
  currentXP: number
  xpForNextLevel: number
  totalXP: number
  progressPercent: number
  title: string
}

const LEVEL_TITLES = [
  'Rookie',
  'Amateur',
  'Enthusiast',
  'Connoisseur',
  'Expert',
  'Master',
  'Grand Master',
  'Legend',
]

export function calculateLevel(totalXP: number): LevelInfo {
  let xpRemaining = totalXP
  let level = 1

  while (true) {
    const xpForThisLevel = 500 + (level - 1) * 100
    if (xpRemaining < xpForThisLevel) {
      return {
        level,
        currentXP: xpRemaining,
        xpForNextLevel: xpForThisLevel,
        totalXP,
        progressPercent: Math.round((xpRemaining / xpForThisLevel) * 100),
        title: getTitle(level),
      }
    }
    xpRemaining -= xpForThisLevel
    level++
  }
}

function getTitle(level: number): string {
  if (level >= 50) return LEVEL_TITLES[7]
  if (level >= 40) return LEVEL_TITLES[6]
  if (level >= 30) return LEVEL_TITLES[5]
  if (level >= 20) return LEVEL_TITLES[4]
  if (level >= 15) return LEVEL_TITLES[3]
  if (level >= 10) return LEVEL_TITLES[2]
  if (level >= 5) return LEVEL_TITLES[1]
  return LEVEL_TITLES[0]
}
