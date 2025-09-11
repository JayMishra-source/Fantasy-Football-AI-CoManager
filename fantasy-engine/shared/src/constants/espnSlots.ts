/**
 * Comprehensive ESPN Fantasy Football Lineup Slot Mappings
 * Based on ESPN API documentation and real-world league configurations
 */

export const ESPN_LINEUP_SLOTS = {
  // Standard starting positions
  QB: 0,
  TQB: 1,        // Team QB (rare)
  RB: 2,
  RB_WR_FLEX: 3, // RB/WR Flex
  WR: 4,
  WR_TE_FLEX: 5, // WR/TE Flex  
  TE: 6,
  OP: 7,         // Offensive Player (Superflex)
  
  // Individual Defensive Player (IDP) positions
  DT: 8,         // Defensive Tackle
  DE: 9,         // Defensive End
  LB: 10,        // Linebacker
  DL: 11,        // Defensive Line
  CB: 12,        // Cornerback
  S: 13,         // Safety
  DB: 14,        // Defensive Back
  DP: 15,        // Defensive Player
  
  // Standard positions continued
  DST: 16,       // Defense/Special Teams
  K: 17,         // Kicker
  P: 18,         // Punter
  HC: 19,        // Head Coach
  
  // Non-starting positions
  BENCH: 20,     // Bench
  IR: 21,        // Injured Reserve
  
  // Flex and utility positions
  RESERVED: 22,  // Reserved/Unknown
  FLEX: 23,      // Flex (RB/WR/TE)
  UTIL: 24,      // Utility (any position)
  SUPER_FLEX: 25 // Superflex (any position including QB)
} as const;

// Reverse mapping: slot ID to position name
export const LINEUP_SLOT_NAMES: { [key: number]: string } = {
  0: 'QB',
  1: 'TQB', 
  2: 'RB',
  3: 'RB/WR',
  4: 'WR',
  5: 'WR/TE',
  6: 'TE',
  7: 'OP',
  8: 'DT',
  9: 'DE', 
  10: 'LB',
  11: 'DL',
  12: 'CB',
  13: 'S',
  14: 'DB',
  15: 'DP',
  16: 'D/ST',
  17: 'K',
  18: 'P',
  19: 'HC',
  20: 'BENCH',
  21: 'IR',
  22: 'RESERVED',
  23: 'FLEX',
  24: 'UTIL',
  25: 'SUPER_FLEX'
};

// Display names for UI components
export const LINEUP_SLOT_DISPLAY_NAMES: { [key: number]: string } = {
  0: 'Quarterback',
  1: 'Team QB',
  2: 'Running Back', 
  3: 'RB/WR Flex',
  4: 'Wide Receiver',
  5: 'WR/TE Flex',
  6: 'Tight End',
  7: 'Offensive Player',
  8: 'Defensive Tackle',
  9: 'Defensive End',
  10: 'Linebacker', 
  11: 'Defensive Line',
  12: 'Cornerback',
  13: 'Safety',
  14: 'Defensive Back',
  15: 'Defensive Player',
  16: 'Defense/ST',
  17: 'Kicker',
  18: 'Punter',
  19: 'Head Coach',
  20: 'Bench',
  21: 'Injured Reserve',
  22: 'Reserved',
  23: 'Flex',
  24: 'Utility',
  25: 'Superflex'
};

/**
 * Determines if a lineup slot ID represents a starting position
 */
export const isStartingPosition = (slotId: number): boolean => {
  // Exclude bench, IR, and unknown/reserved slots
  return slotId !== ESPN_LINEUP_SLOTS.BENCH && 
         slotId !== ESPN_LINEUP_SLOTS.IR && 
         slotId !== ESPN_LINEUP_SLOTS.RESERVED &&
         LINEUP_SLOT_NAMES[slotId] !== undefined;
};

/**
 * Determines if a lineup slot ID is a bench position
 */
export const isBenchPosition = (slotId: number): boolean => {
  return slotId === ESPN_LINEUP_SLOTS.BENCH;
};

/**
 * Determines if a lineup slot ID is an IR position
 */
export const isIRPosition = (slotId: number): boolean => {
  return slotId === ESPN_LINEUP_SLOTS.IR;
};

/**
 * Determines if a lineup slot ID is for Individual Defensive Players
 */
export const isIDPPosition = (slotId: number): boolean => {
  return slotId >= ESPN_LINEUP_SLOTS.DT && slotId <= ESPN_LINEUP_SLOTS.DP;
};

/**
 * Determines if a lineup slot ID is a flex position
 */
export const isFlexPosition = (slotId: number): boolean => {
  return [
    ESPN_LINEUP_SLOTS.RB_WR_FLEX as number,
    ESPN_LINEUP_SLOTS.WR_TE_FLEX as number,
    ESPN_LINEUP_SLOTS.FLEX as number,
    ESPN_LINEUP_SLOTS.UTIL as number,
    ESPN_LINEUP_SLOTS.SUPER_FLEX as number,
    ESPN_LINEUP_SLOTS.OP as number
  ].includes(slotId);
};

/**
 * Gets a safe position name, with fallback for unknown slot IDs
 */
export const getPositionName = (slotId: number): string => {
  return LINEUP_SLOT_NAMES[slotId] || `UNKNOWN_${slotId}`;
};

/**
 * Gets a display-friendly position name
 */
export const getPositionDisplayName = (slotId: number): string => {
  return LINEUP_SLOT_DISPLAY_NAMES[slotId] || `Unknown Position (${slotId})`;
};

/**
 * League configuration types for different roster formats
 */
export interface LeagueRosterSettings {
  hasIDP: boolean;
  hasSuperflex: boolean;
  hasTeamQB: boolean;
  hasPunters: boolean;
  hasHeadCoaches: boolean;
  customSlots?: { [slotId: number]: string };
}

/**
 * Detects league configuration based on slot usage
 */
export const detectLeagueSettings = (usedSlotIds: number[]): LeagueRosterSettings => {
  return {
    hasIDP: usedSlotIds.some(id => isIDPPosition(id)),
    hasSuperflex: usedSlotIds.includes(ESPN_LINEUP_SLOTS.SUPER_FLEX) || usedSlotIds.includes(ESPN_LINEUP_SLOTS.OP),
    hasTeamQB: usedSlotIds.includes(ESPN_LINEUP_SLOTS.TQB),
    hasPunters: usedSlotIds.includes(ESPN_LINEUP_SLOTS.P),
    hasHeadCoaches: usedSlotIds.includes(ESPN_LINEUP_SLOTS.HC)
  };
};