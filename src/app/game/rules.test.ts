import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import { resolveCombat } from './combat';
import { generateWorldMap } from './map-generator';
import { GAME_BALANCE } from './balance';
import { Territory } from './types';

test('Procedural map generator creates connected territories with valid geometry', () => {
  const territories = generateWorldMap('world');
  assert.ok(territories.length >= 60, `Should generate at least 60 territories, got ${territories.length}`);

  // Check that every territory has valid polygon, center, and at least 2 neighbors
  for (const terr of territories) {
    assert.ok(terr.id.startsWith('T'), 'Territory must have valid ID');
    assert.ok(terr.polygon.length >= 5, 'Territory must have at least 5 vertices');
    assert.ok(terr.neighboringTerritoryIds.length >= 2, `Territory ${terr.id} should have >= 2 neighbors`);
    assert.ok(terr.troopCount > 0, 'Neutral territory should have initial garrison');
  }

  // Verify bidirectional neighbor consistency
  for (const terr of territories) {
    for (const neighborId of terr.neighboringTerritoryIds) {
      const neighbor = territories.find(t => t.id === neighborId);
      assert.ok(neighbor, `Neighbor ${neighborId} must exist in territory list`);
      assert.ok(
        neighbor.neighboringTerritoryIds.includes(terr.id),
        `Adjacency must be bidirectional between ${terr.id} and ${neighborId}`
      );
    }
  }
});

test('Combat engine correctly awards victory to superior forces with realistic casualties', () => {
  const mockTerritory: Territory = {
    id: 'T1',
    name: 'North Plains',
    region: 'Northland',
    polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
    center: [5, 5],
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    ownerId: null,
    neighboringTerritoryIds: ['T2'],
    terrainType: 'plains',
    economicValue: 2.0,
    defenseMultiplier: 1.0,
    troopCount: 200,
    buildings: [],
    isCapital: false,
  };

  // Overwhelming attacker (1000 vs 200)
  const resultWin = resolveCombat(1000, mockTerritory);
  assert.equal(resultWin.won, true, 'Attacker with 1000 troops should defeat 200 neutral garrison');
  assert.ok(resultWin.survivingAttackingTroops > 600, 'Overwhelming attacker should retain bulk of forces');
  assert.equal(resultWin.defenderCasualties, 200, 'Defender should be wiped out');

  // Underpowered attacker (100 vs 200)
  const resultLoss = resolveCombat(100, mockTerritory);
  assert.equal(resultLoss.won, false, 'Attacker with 100 troops should fail against 200 garrison');
  assert.equal(resultLoss.survivingAttackingTroops, 0);
  assert.ok(resultLoss.defenderCasualties > 0 && resultLoss.defenderCasualties < 200);
});

test('Defense posts provide defensive bonuses in combat', () => {
  const mockFortified: Territory = {
    id: 'T2',
    name: 'Mountain Fortress',
    region: 'Eurania',
    polygon: [[0, 0], [10, 0], [10, 10], [0, 10]],
    center: [5, 5],
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
    ownerId: 'ai_1',
    neighboringTerritoryIds: ['T1'],
    terrainType: 'mountains', // 1.5x terrain defense
    economicValue: 1.0,
    defenseMultiplier: 1.5,
    troopCount: 500,
    buildings: [
      {
        id: 'b1',
        territoryId: 'T2',
        type: 'defense_post',
        level: 1,
        completed: true,
        constructionProgress: 1.0,
        buildTimeSec: 6,
      },
    ],
    isCapital: false,
  };

  // With mountains (1.5) + defense post (+0.5) * defender efficiency (1.15) = 2.3x defense multiplier
  // 500 * 2.3 = 1150 effective defense power.
  // 800 attackers should fail
  const result = resolveCombat(800, mockFortified);
  assert.equal(result.won, false, '800 attackers should fail against 500 fortified mountain troops');
  assert.ok(result.defenseMultiplierUsed > 2.0, 'Defense multiplier should reflect terrain and defense post');
});

test('Game engine initializes match with 20-50 AI nations and claims capital', () => {
  const engine = new GameEngine({ aiCount: 25, startingGold: 2000, startingTroops: 1200, randomStart: true });
  engine.initMatch();

  assert.equal(engine.nations.size, 26, 'Should have 1 player + 25 AI nations = 26 total nations');
  assert.equal(engine.matchStatus, 'playing', 'Engine should be playing after random start');

  const player = engine.nations.get('player');
  assert.ok(player, 'Player nation must exist');
  assert.equal(player.ownedTerritoryIds.length, 1, 'Player should start with 1 territory');
  assert.ok(player.gold >= 2000, 'Player starting gold initialized');
  assert.ok(player.troopGenerationRate > 0, 'Troop generation rate should be positive');
  assert.ok(player.goldGenerationRate > 0, 'Gold generation rate should be positive');
});

test('Troop marches and combat resolution update ownership properly', () => {
  const engine = new GameEngine({ aiCount: 5, randomStart: false });
  engine.initMatch();

  // Find a neutral territory and manual claim
  const firstNeutral = engine.territories.find(t => t.ownerId === null);
  assert.ok(firstNeutral);
  engine.claimStartingTerritory(firstNeutral.id);

  assert.equal(engine.matchStatus, 'playing');
  const playerTerr = engine.territories.find(t => t.id === firstNeutral.id)!;
  playerTerr.troopCount = 2000; // Give massive garrison

  // Find an adjacent target
  const adjacentId = playerTerr.neighboringTerritoryIds[0];
  const targetTerr = engine.territories.find(t => t.id === adjacentId)!;
  targetTerr.troopCount = 50; // Low defender

  // Launch 80% attack
  const launched = engine.launchAttack('player', playerTerr.id, targetTerr.id, 80);
  assert.equal(launched, true, 'Attack launch should succeed');
  assert.equal(engine.activeMarches.length, 1, 'Should have 1 active march in transit');

  // Advance simulation time until arrival
  engine.advance(4.0);

  // Target territory should now be conquered by player
  assert.equal(targetTerr.ownerId, 'player', 'Player should have conquered the territory');
  assert.ok(engine.battleNotifications.length >= 1, 'Battle notification should be logged');
  assert.equal(engine.totalBattlesWon, 1, 'Player battles won should be 1');
});

test('Building construction deducts gold and completes after timer', () => {
  const engine = new GameEngine({ aiCount: 5, randomStart: true });
  engine.initMatch();

  const player = engine.nations.get('player')!;
  const terrId = player.ownedTerritoryIds[0];
  const prevGold = player.gold;
  const prevTroopRate = player.troopGenerationRate;

  const built = engine.constructBuilding('player', terrId, 'military_base');
  assert.equal(built, true, 'Should successfully start building military base');
  assert.equal(player.gold, prevGold - GAME_BALANCE.BUILDINGS.military_base.cost, 'Gold should be deducted');

  const terr = engine.territories.find(t => t.id === terrId)!;
  const b = terr.buildings.find(item => item.type === 'military_base')!;
  assert.equal(b.completed, false, 'Building should not be complete initially');

  // Advance simulation by 11 seconds (military base takes 10s)
  engine.advance(11.0);

  assert.equal(b.completed, true, 'Building should be completed');
  assert.ok(
    player.troopGenerationRate > prevTroopRate,
    'Troop generation rate should increase after military base completion'
  );
});
