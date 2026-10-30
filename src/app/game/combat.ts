import { CombatResult, Territory } from './types';
import { GAME_BALANCE } from './balance';

/**
 * Deterministic combat resolution algorithm.
 * Accounts for attacking troop count, defending garrison, terrain modifier,
 * defensive structures, and home defense advantage.
 */
export function resolveCombat(
  attackingTroops: number,
  defendingTerritory: Territory
): CombatResult {
  const defendingTroops = Math.max(0, defendingTerritory.troopCount);

  // Calculate total defense multiplier
  const terrainMultiplier = GAME_BALANCE.TERRAIN_DEFENSE[defendingTerritory.terrainType] || 1.0;
  
  // Calculate completed defense post bonuses
  let defensePostBonus = 0;
  for (const b of defendingTerritory.buildings) {
    if (b.type === 'defense_post' && b.completed) {
      defensePostBonus += GAME_BALANCE.BUILDINGS.defense_post.defenseMultiplierAdd * b.level;
    }
  }

  const totalDefenseMultiplier = (terrainMultiplier + defensePostBonus) * GAME_BALANCE.BASE_DEFENDER_EFFICIENCY;
  const totalAttackerMultiplier = GAME_BALANCE.BASE_ATTACKER_EFFICIENCY;

  const attackerEffectivePower = attackingTroops * totalAttackerMultiplier;
  const defenderEffectivePower = defendingTroops * totalDefenseMultiplier;

  if (attackerEffectivePower > defenderEffectivePower) {
    // Attacker wins!
    // Defender is wiped out
    const defenderCasualties = defendingTroops;

    // Attacker casualties depend on how close the defender's effective power was
    const lossRatio = Math.min(0.9, defenderEffectivePower / (attackerEffectivePower + 1));
    const attackerCasualties = Math.round(attackingTroops * lossRatio);
    const survivingAttackingTroops = Math.max(1, attackingTroops - attackerCasualties);

    return {
      won: true,
      survivingAttackingTroops,
      attackerCasualties,
      defenderCasualties,
      defenseMultiplierUsed: totalDefenseMultiplier,
    };
  } else {
    // Defender successfully repels the attack!
    const attackerCasualties = attackingTroops; // Full attacking force wiped out
    const defenseLossRatio = Math.min(0.85, (attackerEffectivePower / (defenderEffectivePower + 1)) * 0.75);
    const defenderCasualties = Math.min(defendingTroops - 1, Math.round(defendingTroops * defenseLossRatio));

    return {
      won: false,
      survivingAttackingTroops: 0,
      attackerCasualties,
      defenderCasualties,
      defenseMultiplierUsed: totalDefenseMultiplier,
    };
  }
}
