export const GAME_BALANCE = {
  // Economics
  STARTING_GOLD: 2000,
  STARTING_TROOPS: 1200,
  BASE_GOLD_PER_SEC: 6,
  BASE_TROOPS_PER_SEC: 12,
  TERRITORY_GOLD_MULT: 1.5,
  TERRITORY_TROOP_MULT: 2.2,

  // Buildings
  BUILDINGS: {
    city: {
      name: 'City',
      cost: 1500,
      buildTimeSec: 8,
      goldBonusPerSec: 15,
      troopBonusPerSec: 6,
      maxPerTerritory: 1,
      description: 'Generates +15 Gold/s & +6 Troops/s.',
    },
    defense_post: {
      name: 'Defense Post',
      cost: 1200,
      buildTimeSec: 6,
      defenseMultiplierAdd: 0.5, // Adds +50% defense power
      maxPerTerritory: 2,
      description: 'Increases territory defense modifier by +50%.',
    },
    military_base: {
      name: 'Military Base',
      cost: 2000,
      buildTimeSec: 10,
      troopBonusPerSec: 20,
      maxPerTerritory: 1,
      description: 'Rapid recruitment station adding +20 Troops/s.',
    },
  },

  // Combat Balancing
  BASE_ATTACKER_EFFICIENCY: 1.0,
  BASE_DEFENDER_EFFICIENCY: 1.15, // Defender's home advantage
  TERRAIN_DEFENSE: {
    plains: 1.0,
    coastal: 1.1,
    hills: 1.25,
    mountains: 1.5,
  },
  MIN_MARCH_DURATION_SEC: 1.2,
  MAX_MARCH_DURATION_SEC: 3.5,
  MIN_DEPLOY_TROOPS: 50,

  // Neutral territories
  NEUTRAL_MIN_GARRISON: 100,
  NEUTRAL_MAX_GARRISON: 350,

  // AI Decision intervals (seconds)
  AI_INTERVALS: {
    easy: { min: 4.0, max: 7.0, aggression: 0.5, buildProb: 0.3 },
    normal: { min: 2.5, max: 4.5, aggression: 0.75, buildProb: 0.55 },
    hard: { min: 1.4, max: 2.8, aggression: 0.95, buildProb: 0.8 },
  },

  // Domination victory threshold (default 100% or 90%)
  DEFAULT_DOMINATION_THRESHOLD: 1.0,
};

// 50 distinctive palette colors for AI nations and player
export const NATION_PALETTES = [
  { name: 'Imperial Emerald (Player)', color: '#10b981', border: '#34d399' },
  { name: 'Crimson Legion', color: '#ef4444', border: '#f87171' },
  { name: 'Azure Republic', color: '#3b82f6', border: '#60a5fa' },
  { name: 'Amber Federation', color: '#f59e0b', border: '#fbbf24' },
  { name: 'Violet Dominion', color: '#8b5cf6', border: '#a78bfa' },
  { name: 'Cyan Directorate', color: '#06b6d4', border: '#22d3ee' },
  { name: 'Rose Syndicate', color: '#f43f5e', border: '#fb7185' },
  { name: 'Fuchsia Empire', color: '#d946ef', border: '#e879f9' },
  { name: 'Orange Combine', color: '#f97316', border: '#fb923c' },
  { name: 'Lime Sovereign', color: '#84cc16', border: '#a3e635' },
  { name: 'Teal Conglomerate', color: '#14b8a6', border: '#2dd4bf' },
  { name: 'Indigo Alliance', color: '#6366f1', border: '#818cf8' },
  { name: 'Gold Enclave', color: '#eab308', border: '#facc15' },
  { name: 'Coral Commonwealth', color: '#ff6b6b', border: '#ffa8a8' },
  { name: 'Cobalt Vanguard', color: '#2563eb', border: '#3b82f6' },
  { name: 'Bronze Coalition', color: '#b45309', border: '#d97706' },
  { name: 'Sapphire Front', color: '#1d4ed8', border: '#60a5fa' },
  { name: 'Ruby Order', color: '#be123c', border: '#f43f5e' },
  { name: 'Mint Protectorate', color: '#059669', border: '#10b981' },
  { name: 'Turquoise Realm', color: '#0891b2', border: '#06b6d4' },
  { name: 'Plum Dynasty', color: '#7c3aed', border: '#8b5cf6' },
  { name: 'Scarlet Pact', color: '#dc2626', border: '#ef4444' },
  { name: 'Sky League', color: '#0284c7', border: '#38bdf8' },
  { name: 'Jade Imperium', color: '#15803d', border: '#22c55e' },
  { name: 'Copper Union', color: '#c2410c', border: '#ea580c' },
  { name: 'Amethyst Hegemony', color: '#9333ea', border: '#c084fc' },
  { name: 'Cerulean Core', color: '#0369a1', border: '#0ea5e9' },
  { name: 'Crimson Peak', color: '#991b1b', border: '#dc2626' },
  { name: 'Sunburst Principality', color: '#ca8a04', border: '#eab308' },
  { name: 'Forest Domain', color: '#166534', border: '#16a34a' },
  { name: 'Maroon Directorate', color: '#881337', border: '#be123c' },
  { name: 'Deep Sea Sector', color: '#0c4a6e', border: '#0284c7' },
  { name: 'Orchid Sovereign', color: '#c026d3', border: '#d946ef' },
  { name: 'Rust Legion', color: '#9a3412', border: '#c2410c' },
  { name: 'Aquamarine State', color: '#0f766e', border: '#14b8a6' },
  { name: 'Royal Twilight', color: '#4338ca', border: '#6366f1' },
  { name: 'Gilded Republic', color: '#a16207', border: '#ca8a04' },
  { name: 'Alpine Concord', color: '#047857', border: '#059669' },
  { name: 'Bloodstone Clan', color: '#7f1d1d', border: '#991b1b' },
  { name: 'Arctic Union', color: '#0e7490', border: '#0891b2' },
  { name: 'Mauve Dominion', color: '#6d28d9', border: '#7c3aed' },
  { name: 'Tangerine Enclave', color: '#ea580c', border: '#f97316' },
  { name: 'Olive Vanguard', color: '#4d7c0f', border: '#65a30d' },
  { name: 'Lagoon Republic', color: '#115e59', border: '#0f766e' },
  { name: 'Berry Empire', color: '#9d174d', border: '#be185d' },
  { name: 'Denim Front', color: '#1e40af', border: '#2563eb' },
  { name: 'Bronze Shield', color: '#78350f', border: '#92400e' },
  { name: 'Glacier Confederation', color: '#155e75', border: '#0e7490' },
  { name: 'Iris Commonwealth', color: '#5b21b6', border: '#6d28d9' },
  { name: 'Desert Sun Enclave', color: '#854d0e', border: '#a16207' },
  { name: 'Verdant Guard', color: '#14532d', border: '#15803d' },
];

export const NATION_NAMES = [
  'Valoria', 'Ostoria', 'Aethelgard', 'Novosibirsk', 'Korinthia',
  'Veridia', 'Arcturus', 'Solaria', 'Drakonia', 'Eldoria',
  'Kyrenia', 'Maribor', 'Zululand', 'Borealis', 'Tarkonia',
  'Vanguardia', 'Cyrene', 'Thalassia', 'Helvetia', 'Kandor',
  'Oakhaven', 'Pelagia', 'Caelum', 'Zephyria', 'Iridia',
  'Stormhold', 'Ironforge', 'Aethelred', 'Hyperion', 'Mirador',
  'Ravencrest', 'Sunspear', 'Frostholm', 'Moravia', 'Aurelia',
  'Castoria', 'Sarkovia', 'Lumina', 'Dunwall', 'Asphodel',
  'Theras', 'Pytheas', 'Volgograd', 'Kandahar', 'Titanica',
  'Gorgon', 'Atlantica', 'Vespera', 'Karnak', 'Alabaster'
];
