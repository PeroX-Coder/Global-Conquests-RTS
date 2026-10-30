export type Difficulty = 'easy' | 'normal' | 'hard';
export type MatchStatus = 'setup' | 'selecting_capital' | 'playing' | 'paused' | 'victory' | 'defeat';
export type TerrainType = 'plains' | 'hills' | 'mountains' | 'coastal';
export type BuildingType = 'city' | 'defense_post' | 'military_base';

export interface Building {
  id: string;
  territoryId: string;
  type: BuildingType;
  level: number;
  completed: boolean;
  constructionProgress: number; // 0 to 1
  buildTimeSec: number;
}

export interface Territory {
  id: string;
  name: string;
  region: string;
  polygon: [number, number][]; // Scaled canvas coordinates [x, y]
  center: [number, number];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  ownerId: string | null; // null if neutral
  neighboringTerritoryIds: string[];
  terrainType: TerrainType;
  economicValue: number; // Base gold production contribution
  defenseMultiplier: number; // 1.0 base, hills 1.2, mountains 1.45
  troopCount: number;
  buildings: Building[];
  isCapital: boolean;
  lastAttackedTime?: number;
}

export interface Nation {
  id: string;
  name: string;
  color: string;
  borderColor: string;
  isPlayer: boolean;
  isEliminated: boolean;
  difficulty: Difficulty;
  gold: number;
  totalTroops: number; // Total troops in reserve + garrisons
  troopGenerationRate: number; // Troops per second
  goldGenerationRate: number; // Gold per second
  ownedTerritoryIds: string[];
  capitalTerritoryId: string | null;
  battlesWon: number;
  battlesLost: number;
  territoriesConquered: number;
  troopsTrained: number;
  troopsLost: number;
  troopsKilled: number;
  aiTimer: number; // Interval tracking for staggered AI
}

export interface TroopMarch {
  id: string;
  attackerNationId: string;
  defenderNationId: string | null;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  troopCount: number;
  progress: number; // 0.0 to 1.0
  durationSec: number;
  startPos: [number, number];
  targetPos: [number, number];
  curveOffset: number;
}

export interface CombatResult {
  won: boolean;
  survivingAttackingTroops: number;
  attackerCasualties: number;
  defenderCasualties: number;
  defenseMultiplierUsed: number;
}

export interface BattleNotification {
  id: string;
  timestamp: number;
  attackerNationId: string;
  defenderNationId: string | null;
  sourceTerritoryId: string;
  targetTerritoryId: string;
  territoryName: string;
  attackingTroops: number;
  defendingTroops: number;
  attackerWon: boolean;
  casualties: number;
  isPlayerInvolved: boolean;
}

export interface GameConfig {
  aiCount: number; // 20 to 50
  difficulty: Difficulty;
  gameSpeed: number; // 1, 2, 4
  startingTroops: number; // default 1200
  startingGold: number; // default 2000
  randomStart: boolean;
  dominationThreshold: number; // e.g. 1.0 = 100%, 0.85 = 85%
  mapPreset: 'world' | 'archipelago' | 'pangaea';
}

export interface GameStatistics {
  elapsedTimeSec: number;
  totalBattles: number;
  totalTroopsLost: number;
  totalTroopsGenerated: number;
  eliminatedNationsCount: number;
  playerRank: number;
  playerTerritoryPercentage: number;
}
