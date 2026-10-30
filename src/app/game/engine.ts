import {
  BuildingType,
  CombatResult,
  GameConfig,
  GameStatistics,
  MatchStatus,
  Nation,
  Territory,
  TroopMarch,
  BattleNotification,
} from './types';
import { GAME_BALANCE, NATION_NAMES, NATION_PALETTES } from './balance';
import { generateWorldMap } from './map-generator';
import { resolveCombat } from './combat';

export class GameEngine {
  public config: GameConfig;
  public territories: Territory[] = [];
  public nations = new Map<string, Nation>();
  public activeMarches: TroopMarch[] = [];
  public battleNotifications: BattleNotification[] = [];
  public matchStatus: MatchStatus = 'setup';
  public isPaused = false;
  public gameTime = 0;
  public playerNationId = 'player';
  public selectedTerritoryId: string | null = null;
  public totalBattlesWon = 0;
  public totalTroopsLost = 0;
  public totalTroopsGenerated = 0;

  // Callback hooks for sounds and UI effects
  public onSoundTrigger?: (sound: string) => void;
  public onBattleOccurred?: (notification: BattleNotification) => void;

  constructor(config?: Partial<GameConfig>) {
    this.config = {
      aiCount: 30,
      difficulty: 'normal',
      gameSpeed: 1,
      startingTroops: GAME_BALANCE.STARTING_TROOPS,
      startingGold: GAME_BALANCE.STARTING_GOLD,
      randomStart: false,
      dominationThreshold: GAME_BALANCE.DEFAULT_DOMINATION_THRESHOLD,
      mapPreset: 'world',
      ...config,
    };
  }

  public initMatch(customConfig?: Partial<GameConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    this.territories = generateWorldMap(this.config.mapPreset);
    this.nations.clear();
    this.activeMarches = [];
    this.battleNotifications = [];
    this.gameTime = 0;
    this.selectedTerritoryId = null;
    this.totalBattlesWon = 0;
    this.totalTroopsLost = 0;
    this.totalTroopsGenerated = 0;

    // 1. Setup Player Nation
    const playerPalette = NATION_PALETTES[0];
    const playerNation: Nation = {
      id: this.playerNationId,
      name: 'Player Republic',
      color: playerPalette.color,
      borderColor: playerPalette.border,
      isPlayer: true,
      isEliminated: false,
      difficulty: this.config.difficulty,
      gold: this.config.startingGold,
      totalTroops: this.config.startingTroops,
      troopGenerationRate: GAME_BALANCE.BASE_TROOPS_PER_SEC,
      goldGenerationRate: GAME_BALANCE.BASE_GOLD_PER_SEC,
      ownedTerritoryIds: [],
      capitalTerritoryId: null,
      battlesWon: 0,
      battlesLost: 0,
      territoriesConquered: 0,
      troopsTrained: 0,
      troopsLost: 0,
      troopsKilled: 0,
      aiTimer: 0,
    };
    this.nations.set(this.playerNationId, playerNation);

    // 2. Setup AI Nations
    const aiCount = Math.min(this.config.aiCount, this.territories.length - 5);
    const availablePalettes = NATION_PALETTES.slice(1);
    const shuffledPalettes = [...availablePalettes].sort(() => 0.5 - Math.random());
    const shuffledNames = [...NATION_NAMES].sort(() => 0.5 - Math.random());

    for (let i = 0; i < aiCount; i++) {
      const aiId = `ai_${i + 1}`;
      const palette = shuffledPalettes[i % shuffledPalettes.length];
      const name = shuffledNames[i % shuffledNames.length];

      const aiNation: Nation = {
        id: aiId,
        name,
        color: palette.color,
        borderColor: palette.border,
        isPlayer: false,
        isEliminated: false,
        difficulty: this.config.difficulty,
        gold: Math.round(this.config.startingGold * (this.config.difficulty === 'hard' ? 1.25 : 1.0)),
        totalTroops: Math.round(this.config.startingTroops * (this.config.difficulty === 'hard' ? 1.2 : 1.0)),
        troopGenerationRate: GAME_BALANCE.BASE_TROOPS_PER_SEC,
        goldGenerationRate: GAME_BALANCE.BASE_GOLD_PER_SEC,
        ownedTerritoryIds: [],
        capitalTerritoryId: null,
        battlesWon: 0,
        battlesLost: 0,
        territoriesConquered: 0,
        troopsTrained: 0,
        troopsLost: 0,
        troopsKilled: 0,
        aiTimer: Math.random() * 2.0, // Stagger initial AI ticks
      };
      this.nations.set(aiId, aiNation);
    }

    // 3. Distribute AI Starting Capitals across distinct regions
    const unassignedTerritories = [...this.territories].sort(() => 0.5 - Math.random());
    let terrIdx = 0;

    for (const nation of this.nations.values()) {
      if (nation.isPlayer) continue;

      if (terrIdx < unassignedTerritories.length) {
        const capitalTerr = unassignedTerritories[terrIdx++];
        capitalTerr.ownerId = nation.id;
        capitalTerr.isCapital = true;
        capitalTerr.troopCount = Math.round(nation.totalTroops * 0.8);
        nation.ownedTerritoryIds.push(capitalTerr.id);
        nation.capitalTerritoryId = capitalTerr.id;
      }
    }

    // 4. Handle Player Start: Random or Manual Selection
    if (this.config.randomStart) {
      // Find unoccupied territory
      const neutralTerrs = this.territories.filter(t => t.ownerId === null);
      if (neutralTerrs.length > 0) {
        const chosen = neutralTerrs[Math.floor(Math.random() * neutralTerrs.length)];
        this.claimStartingTerritory(chosen.id);
      } else {
        this.claimStartingTerritory(this.territories[0].id);
      }
    } else {
      this.matchStatus = 'selecting_capital';
    }
  }

  public claimStartingTerritory(territoryId: string): boolean {
    const terr = this.territories.find(t => t.id === territoryId);
    if (!terr) return false;
    if (terr.ownerId !== null && terr.ownerId !== this.playerNationId) return false;

    const player = this.nations.get(this.playerNationId);
    if (!player) return false;

    terr.ownerId = player.id;
    terr.isCapital = true;
    terr.troopCount = Math.round(player.totalTroops * 0.85);
    player.ownedTerritoryIds = [terr.id];
    player.capitalTerritoryId = terr.id;

    this.matchStatus = 'playing';
    this.selectedTerritoryId = terr.id;
    this.recalculateNationRates(player);

    if (this.onSoundTrigger) this.onSoundTrigger('conquest');
    return true;
  }

  public selectTerritory(territoryId: string | null) {
    this.selectedTerritoryId = territoryId;
    if (territoryId && this.onSoundTrigger) {
      this.onSoundTrigger('select');
    }
  }

  /**
   * Launch an attack from an owned territory towards an adjacent enemy/neutral territory.
   */
  public launchAttack(
    attackerNationId: string,
    sourceTerritoryId: string,
    targetTerritoryId: string,
    percentage: number
  ): boolean {
    const source = this.territories.find(t => t.id === sourceTerritoryId);
    const target = this.territories.find(t => t.id === targetTerritoryId);

    if (!source || !target) return false;
    if (source.ownerId !== attackerNationId) return false;
    if (source.ownerId === target.ownerId) return false; // Can't attack own territory
    if (!source.neighboringTerritoryIds.includes(target.id)) return false; // Must be adjacent

    const deployPercent = Math.max(10, Math.min(100, percentage)) / 100;
    // Leave at least 1 defender in source
    const availableToDeploy = Math.max(0, source.troopCount - 1);
    const deployCount = Math.floor(availableToDeploy * deployPercent);

    if (deployCount < 1) return false;

    source.troopCount -= deployCount;

    // Calculate march duration based on distance
    const dx = target.center[0] - source.center[0];
    const dy = target.center[1] - source.center[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(
      GAME_BALANCE.MIN_MARCH_DURATION_SEC,
      Math.min(GAME_BALANCE.MAX_MARCH_DURATION_SEC, dist / 90)
    );

    const march: TroopMarch = {
      id: `march_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      attackerNationId,
      defenderNationId: target.ownerId,
      sourceTerritoryId,
      targetTerritoryId,
      troopCount: deployCount,
      progress: 0,
      durationSec: duration,
      startPos: [...source.center],
      targetPos: [...target.center],
      curveOffset: (Math.random() - 0.5) * 40,
    };

    this.activeMarches.push(march);

    if (attackerNationId === this.playerNationId && this.onSoundTrigger) {
      this.onSoundTrigger('attack');
    }

    return true;
  }

  /**
   * Construct an economic or military building in an owned territory
   */
  public constructBuilding(nationId: string, territoryId: string, type: BuildingType): boolean {
    const terr = this.territories.find(t => t.id === territoryId);
    const nation = this.nations.get(nationId);

    if (!terr || !nation) return false;
    if (terr.ownerId !== nationId) return false;

    const bConfig = GAME_BALANCE.BUILDINGS[type];
    if (!bConfig) return false;
    if (nation.gold < bConfig.cost) return false;

    // Check max allowed per territory
    const existingCount = terr.buildings.filter(b => b.type === type).length;
    if (existingCount >= bConfig.maxPerTerritory) return false;

    // Deduct gold
    nation.gold -= bConfig.cost;

    const building = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      territoryId: terr.id,
      type,
      level: 1,
      completed: false,
      constructionProgress: 0,
      buildTimeSec: bConfig.buildTimeSec,
    };

    terr.buildings.push(building);

    if (nationId === this.playerNationId && this.onSoundTrigger) {
      this.onSoundTrigger('build');
    }

    return true;
  }

  /**
   * Advance simulation time across multiple discrete steps.
   */
  public advance(totalSeconds: number, step = 0.04) {
    let remaining = totalSeconds;
    while (remaining > 0) {
      const cur = Math.min(remaining, step);
      this.update(cur);
      remaining -= cur;
    }
  }

  /**
   * Main game tick: advances time, updates marches, resolves arrivals,
   * generates gold & troops, advances buildings, ticks AI, and checks game over.
   */
  public update(rawDt: number) {
    if (this.isPaused || this.matchStatus !== 'playing') return;

    // Clamp dt to prevent simulation explosion on lag/tab switch
    const clampedDt = Math.min(rawDt, 0.05);
    const dt = clampedDt * this.config.gameSpeed;
    this.gameTime += dt;

    // 1. Update Active Troop Marches
    for (let i = this.activeMarches.length - 1; i >= 0; i--) {
      const march = this.activeMarches[i];
      march.progress += dt / march.durationSec;

      if (march.progress >= 1.0) {
        // Resolve Battle on Arrival
        this.resolveMarchArrival(march);
        this.activeMarches.splice(i, 1);
      }
    }

    // 2. Update Building Construction
    for (const terr of this.territories) {
      for (const building of terr.buildings) {
        if (!building.completed) {
          building.constructionProgress += dt / building.buildTimeSec;
          if (building.constructionProgress >= 1.0) {
            building.completed = true;
            building.constructionProgress = 1.0;
            if (terr.ownerId) {
              const owner = this.nations.get(terr.ownerId);
              if (owner) this.recalculateNationRates(owner);
            }
          }
        }
      }
    }

    // 3. Automatic Troop and Gold Generation
    for (const nation of this.nations.values()) {
      if (nation.isEliminated || nation.ownedTerritoryIds.length === 0) continue;

      this.recalculateNationRates(nation);

      // Add gold
      const goldGained = nation.goldGenerationRate * dt;
      nation.gold += goldGained;

      // Add troops to garrisons
      const troopsGained = nation.troopGenerationRate * dt;
      nation.totalTroops += troopsGained;
      nation.troopsTrained += troopsGained;
      if (nation.isPlayer) {
        this.totalTroopsGenerated += troopsGained;
      }

      // Distribute troops across owned territories (weighted towards frontlines or capital)
      const ownedTerrs = this.territories.filter(t => t.ownerId === nation.id);
      if (ownedTerrs.length > 0) {
        const perTerr = troopsGained / ownedTerrs.length;
        for (const t of ownedTerrs) {
          t.troopCount += perTerr;
        }
      }

      // 4. Update AI Decisions
      if (!nation.isPlayer) {
        this.updateAI(nation, dt);
      }
    }

    // 5. Evaluate Victory and Defeat Conditions
    this.checkMatchConditions();
  }

  private resolveMarchArrival(march: TroopMarch) {
    const target = this.territories.find(t => t.id === march.targetTerritoryId);
    const attackerNation = this.nations.get(march.attackerNationId);
    if (!target || !attackerNation) return;

    const defenderNation = target.ownerId ? this.nations.get(target.ownerId) : null;
    const isPlayerTarget = target.ownerId === this.playerNationId;
    const isPlayerAttacking = march.attackerNationId === this.playerNationId;

    // Play clash impact sound
    if ((isPlayerTarget || isPlayerAttacking) && this.onSoundTrigger) {
      this.onSoundTrigger('clash');
    }

    // Resolve combat
    const result: CombatResult = resolveCombat(march.troopCount, target);

    // Update casualties
    attackerNation.troopsLost += result.attackerCasualties;
    attackerNation.totalTroops = Math.max(0, attackerNation.totalTroops - result.attackerCasualties);
    if (attackerNation.isPlayer) {
      this.totalTroopsLost += result.attackerCasualties;
    }

    if (defenderNation) {
      defenderNation.troopsLost += result.defenderCasualties;
      defenderNation.totalTroops = Math.max(0, defenderNation.totalTroops - result.defenderCasualties);
      if (defenderNation.isPlayer) {
        this.totalTroopsLost += result.defenderCasualties;
      }
    }

    if (result.won) {
      // Attacker captures the territory!
      attackerNation.battlesWon++;
      attackerNation.territoriesConquered++;
      if (attackerNation.isPlayer) this.totalBattlesWon++;

      if (defenderNation) {
        defenderNation.battlesLost++;
        // Remove territory from previous defender
        defenderNation.ownedTerritoryIds = defenderNation.ownedTerritoryIds.filter(id => id !== target.id);
        this.recalculateNationRates(defenderNation);

        // Check if defender eliminated
        if (defenderNation.ownedTerritoryIds.length === 0) {
          defenderNation.isEliminated = true;
        }
      }

      // Set new owner and garrison
      target.ownerId = attackerNation.id;
      target.troopCount = result.survivingAttackingTroops;
      attackerNation.ownedTerritoryIds.push(target.id);
      this.recalculateNationRates(attackerNation);

      // Defense posts take partial damage upon conquest
      target.buildings = target.buildings.filter(b => b.type !== 'defense_post');

      if (isPlayerAttacking && this.onSoundTrigger) {
        this.onSoundTrigger('conquest');
      }
    } else {
      // Defender retained territory
      target.troopCount = Math.max(1, target.troopCount - result.defenderCasualties);
      if (defenderNation) {
        defenderNation.battlesWon++;
      }
      attackerNation.battlesLost++;
    }

    target.lastAttackedTime = this.gameTime;

    // Create Notification
    const notif: BattleNotification = {
      id: `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: this.gameTime,
      attackerNationId: attackerNation.id,
      defenderNationId: defenderNation ? defenderNation.id : null,
      sourceTerritoryId: march.sourceTerritoryId,
      targetTerritoryId: target.id,
      territoryName: target.name,
      attackingTroops: march.troopCount,
      defendingTroops: target.troopCount + result.defenderCasualties,
      attackerWon: result.won,
      casualties: result.attackerCasualties + result.defenderCasualties,
      isPlayerInvolved: isPlayerAttacking || isPlayerTarget,
    };

    this.battleNotifications.unshift(notif);
    if (this.battleNotifications.length > 25) {
      this.battleNotifications.pop();
    }

    if (this.onBattleOccurred) {
      this.onBattleOccurred(notif);
    }
  }

  public recalculateNationRates(nation: Nation) {
    let goldRate = GAME_BALANCE.BASE_GOLD_PER_SEC;
    let troopRate = GAME_BALANCE.BASE_TROOPS_PER_SEC;

    for (const terrId of nation.ownedTerritoryIds) {
      const terr = this.territories.find(t => t.id === terrId);
      if (!terr) continue;

      goldRate += terr.economicValue * GAME_BALANCE.TERRITORY_GOLD_MULT;
      troopRate += GAME_BALANCE.TERRITORY_TROOP_MULT;

      // Add building contributions
      for (const b of terr.buildings) {
        if (!b.completed) continue;
        if (b.type === 'city') {
          goldRate += GAME_BALANCE.BUILDINGS.city.goldBonusPerSec;
          troopRate += GAME_BALANCE.BUILDINGS.city.troopBonusPerSec;
        } else if (b.type === 'military_base') {
          troopRate += GAME_BALANCE.BUILDINGS.military_base.troopBonusPerSec;
        }
      }
    }

    nation.goldGenerationRate = Math.round(goldRate * 10) / 10;
    nation.troopGenerationRate = Math.round(troopRate * 10) / 10;
  }

  /**
   * Autonomous AI Controller:
   * Periodically scans neighbor territories, prioritizes easy neutral conquests,
   * strikes vulnerable enemies, builds cities and defensive posts.
   */
  private updateAI(nation: Nation, dt: number) {
    nation.aiTimer -= dt;
    if (nation.aiTimer > 0) return;

    // Reset AI interval according to difficulty
    const intervals = GAME_BALANCE.AI_INTERVALS[nation.difficulty] || GAME_BALANCE.AI_INTERVALS.normal;
    nation.aiTimer = intervals.min + Math.random() * (intervals.max - intervals.min);

    const ownedTerrs = this.territories.filter(t => t.ownerId === nation.id);
    if (ownedTerrs.length === 0) return;

    // 1. AI Building Decision:
    if (Math.random() < intervals.buildProb) {
      if (nation.gold >= GAME_BALANCE.BUILDINGS.city.cost) {
        // Find safe interior territory without a city
        const interior = ownedTerrs.find(t => {
          const hasCity = t.buildings.some(b => b.type === 'city');
          const hasHostileNeighbor = t.neighboringTerritoryIds.some(nId => {
            const n = this.territories.find(item => item.id === nId);
            return n && n.ownerId !== nation.id;
          });
          return !hasCity && !hasHostileNeighbor;
        });

        if (interior) {
          this.constructBuilding(nation.id, interior.id, 'city');
        } else if (nation.gold >= GAME_BALANCE.BUILDINGS.military_base.cost) {
          const baseTarget = ownedTerrs.find(t => !t.buildings.some(b => b.type === 'military_base'));
          if (baseTarget) {
            this.constructBuilding(nation.id, baseTarget.id, 'military_base');
          }
        }
      } else if (nation.gold >= GAME_BALANCE.BUILDINGS.defense_post.cost) {
        // Build defense post on threatened border territory
        const borderTerr = ownedTerrs.find(t => {
          const hasPost = t.buildings.some(b => b.type === 'defense_post');
          const hasHostile = t.neighboringTerritoryIds.some(nId => {
            const n = this.territories.find(item => item.id === nId);
            return n && n.ownerId !== nation.id;
          });
          return !hasPost && hasHostile;
        });

        if (borderTerr) {
          this.constructBuilding(nation.id, borderTerr.id, 'defense_post');
        }
      }
    }

    // 2. AI Attack Decision:
    // Sort owned territories by troop count (highest first)
    ownedTerrs.sort((a, b) => b.troopCount - a.troopCount);
    const strongestSource = ownedTerrs[0];

    if (!strongestSource || strongestSource.troopCount < GAME_BALANCE.MIN_DEPLOY_TROOPS) return;

    // Find all neighboring targets
    const validTargets: { territory: Territory; isNeutral: boolean; ratio: number }[] = [];

    for (const neighborId of strongestSource.neighboringTerritoryIds) {
      const neighbor = this.territories.find(t => t.id === neighborId);
      if (!neighbor || neighbor.ownerId === nation.id) continue;

      const isNeutral = neighbor.ownerId === null;
      const ratio = strongestSource.troopCount / Math.max(1, neighbor.troopCount);

      validTargets.push({ territory: neighbor, isNeutral, ratio });
    }

    if (validTargets.length === 0) return;

    // Prefer neutral targets first for easy expansion, or vulnerable enemies
    validTargets.sort((a, b) => {
      if (a.isNeutral && !b.isNeutral) return -1;
      if (!a.isNeutral && b.isNeutral) return 1;
      return b.ratio - a.ratio;
    });

    const chosenTarget = validTargets[0];
    // Check if attack is strategically viable (ratio > 1.25 for neutral, or > 1.5 for enemy)
    const requiredRatio = chosenTarget.isNeutral ? 1.15 : 1.45 * (1.2 - intervals.aggression * 0.4);

    if (chosenTarget.ratio >= requiredRatio) {
      const percent = chosenTarget.isNeutral ? 60 : 75;
      this.launchAttack(nation.id, strongestSource.id, chosenTarget.territory.id, percent);
    }
  }

  private checkMatchConditions() {
    const player = this.nations.get(this.playerNationId);
    if (!player) return;

    // Defeat Check
    if (player.ownedTerritoryIds.length === 0 && this.matchStatus === 'playing') {
      this.matchStatus = 'defeat';
      if (this.onSoundTrigger) this.onSoundTrigger('defeat');
      return;
    }

    // Victory Check (Domination)
    const totalLandTerritories = this.territories.length;
    const playerTerritories = player.ownedTerritoryIds.length;
    const dominationPct = playerTerritories / totalLandTerritories;

    if (dominationPct >= this.config.dominationThreshold && this.matchStatus === 'playing') {
      this.matchStatus = 'victory';
      if (this.onSoundTrigger) this.onSoundTrigger('victory');
    }
  }

  public getStatistics(): GameStatistics {
    const player = this.nations.get(this.playerNationId);
    const totalLand = this.territories.length;
    const playerTerritories = player ? player.ownedTerritoryIds.length : 0;
    const percentage = totalLand > 0 ? (playerTerritories / totalLand) * 100 : 0;

    let eliminated = 0;
    const sortedNations = Array.from(this.nations.values())
      .filter(n => {
        if (n.isEliminated || n.ownedTerritoryIds.length === 0) {
          eliminated++;
          return false;
        }
        return true;
      })
      .sort((a, b) => b.ownedTerritoryIds.length - a.ownedTerritoryIds.length);

    const playerRank = sortedNations.findIndex(n => n.isPlayer) + 1;

    return {
      elapsedTimeSec: Math.floor(this.gameTime),
      totalBattles: this.totalBattlesWon + (player ? player.battlesLost : 0),
      totalTroopsLost: Math.round(this.totalTroopsLost),
      totalTroopsGenerated: Math.round(this.totalTroopsGenerated),
      eliminatedNationsCount: eliminated,
      playerRank: playerRank > 0 ? playerRank : sortedNations.length + 1,
      playerTerritoryPercentage: Math.round(percentage * 10) / 10,
    };
  }

  public getAdjacentEnemyTargets(sourceTerritoryId: string): Territory[] {
    const source = this.territories.find(t => t.id === sourceTerritoryId);
    if (!source || !source.ownerId) return [];

    return this.territories.filter(t =>
      source.neighboringTerritoryIds.includes(t.id) && t.ownerId !== source.ownerId
    );
  }
}
