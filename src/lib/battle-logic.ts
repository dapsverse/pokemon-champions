import { BattlePokemon, Move, BattleState, MoveRecommendation, Weather, PokemonType } from '../types/pokemon';
import { getTypeEffectiveness, calculateSTAB } from './type-chart';
import { calculateWeatherDamageModifier } from './weather-utils';

const TYPE_NAMES: PokemonType[] = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel', 'Dark', 'Fairy'
];

function normalizeMoveType(type: unknown): PokemonType {
  if (typeof type !== 'string') return 'Normal';
  const trimmed = type.trim();
  const direct = TYPE_NAMES.find(t => t === trimmed);
  if (direct) return direct;
  const m = /^(Normal|Fire|Water|Electric|Grass|Ice|Fighting|Poison|Ground|Flying|Psychic|Bug|Rock|Ghost|Dragon|Steel|Dark|Fairy)\b/i.exec(trimmed);
  if (m) return m[1] as PokemonType;
  return 'Normal';
}

function normalizeMoveCategory(attacker: BattlePokemon, move: Move): Move['category'] {
  const power = typeof move.power === 'number' ? move.power : 0;
  if (move.category === 'Physical' || move.category === 'Special' || move.category === 'Status') {
    if (move.category !== 'Status') return move.category;
    if (power > 0) return attacker.stats.atk >= attacker.stats.spa ? 'Physical' : 'Special';
    return 'Status';
  }
  if (power > 0) return attacker.stats.atk >= attacker.stats.spa ? 'Physical' : 'Special';
  return 'Status';
}

/**
 * Simplified Damage Calculation
 */
export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move,
  weather: Weather = 'None'
): number {
  const basePower = typeof move.power === 'number' ? move.power : 0;
  if (basePower <= 0) return 0;

  const type = normalizeMoveType((move as any).type);
  const category = normalizeMoveCategory(attacker, move);
  if (category === 'Status') return 0;

  const level = 50; // Assume standard level 50
  
  // Get relevant stats based on category
  const atk = category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
  const def = category === 'Physical' ? defender.stats.def : defender.stats.spd;

  // Apply stat stages (Simplified multiplier)
  const statMultiplier = (stage: number) => {
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 - stage);
  };

  const finalAtk = atk * statMultiplier(category === 'Physical' ? attacker.statStages.atk : attacker.statStages.spa);
  const finalDef = def * statMultiplier(category === 'Physical' ? defender.statStages.def : defender.statStages.spd);

  // Core damage formula (Simplified)
  let damage = (((2 * level / 5 + 2) * basePower * (finalAtk / finalDef)) / 50 + 2);

  // Modifiers
  let modifier = 1.0;
  
  // STAB
  modifier *= calculateSTAB(type, attacker.types, attacker.activeAbility?.name === 'Adaptability');
  
  // Type Effectiveness
  modifier *= getTypeEffectiveness(type, defender.types);
  
  // Weather
  modifier *= calculateWeatherDamageModifier(type, weather);

  // Status Modifiers
  if (attacker.status === 'Burn' && category === 'Physical' && attacker.activeAbility?.name !== 'Guts') {
    modifier *= 0.5;
  }

  // Item Modifiers (Common items in Meta)
  if (attacker.item === 'Life Orb') modifier *= 1.3;
  if (attacker.item === 'Choice Band' && category === 'Physical') modifier *= 1.5;
  if (attacker.item === 'Choice Specs' && category === 'Special') modifier *= 1.5;
  if (attacker.item === 'Expert Belt' && getTypeEffectiveness(type, defender.types) > 1) modifier *= 1.2;
  
  // Defensive Item Modifiers
  if (defender.item === 'Assault Vest' && category === 'Special') modifier *= 0.67;

  return damage * modifier;
}

/**
 * Evaluates a state from the perspective of 'myTeam'
 */
export function evaluateState(state: BattleState): number {
  const me = state.myTeam[state.myActiveIndices[0]];
  const opp = state.opponentTeam[state.opponentActiveIndices[0]];

  if (!me || !opp) return 0;

  // 1. HP Ratio Score (Adjust for Status Chip Damage)
  let myEffectiveHp = me.currentHp;
  if (me.status === 'Poison' || me.status === 'Burn') myEffectiveHp -= me.stats.hp * 0.0625;
  if (me.status === 'Toxic') myEffectiveHp -= me.stats.hp * (me.toxicCounter * 0.0625);

  let oppEffectiveHp = opp.currentHp;
  if (opp.status === 'Poison' || opp.status === 'Burn') oppEffectiveHp -= opp.stats.hp * 0.0625;
  if (opp.status === 'Toxic') oppEffectiveHp -= opp.stats.hp * (opp.toxicCounter * 0.0625);

  const myHpRatio = myEffectiveHp / me.stats.hp;
  const oppHpRatio = oppEffectiveHp / opp.stats.hp;
  
  // 2. Damage Potential
  let myMaxDamage = 0;
  if (me.status !== 'Sleep' && me.status !== 'Freeze') {
    me.selectedMoves.forEach(m => {
      myMaxDamage = Math.max(myMaxDamage, calculateDamage(me, opp, m, state.weather));
    });
  }

  let oppMaxDamage = 0;
  if (opp.status !== 'Sleep' && opp.status !== 'Freeze') {
    opp.selectedMoves.forEach(m => {
      oppMaxDamage = Math.max(oppMaxDamage, calculateDamage(opp, me, m, state.weather));
    });
  }

  // Normalize damage relative to defender HP
  const myKillPotential = myMaxDamage / opp.stats.hp;
  const oppKillPotential = oppMaxDamage / me.stats.hp;

  // 3. Speed Advantage (Adjust for Paralysis)
  const mySpe = me.status === 'Paralysis' ? me.stats.spe * 0.5 : me.stats.spe;
  const oppSpe = opp.status === 'Paralysis' ? opp.stats.spe * 0.5 : opp.stats.spe;
  
  // Choice Scarf Check
  const myFinalSpe = me.item === 'Choice Scarf' ? mySpe * 1.5 : mySpe;
  const oppFinalSpe = opp.item === 'Choice Scarf' ? oppSpe * 1.5 : oppSpe;

  const speedAdvantage = myFinalSpe > oppFinalSpe ? 15 : -15;

  // 4. Status Penalty
  const myStatusPenalty = (me.status !== 'None' ? -20 : 0);
  const oppStatusPenalty = (opp.status !== 'None' ? 20 : 0);

  // Final Evaluation Score
  return (myHpRatio - oppHpRatio) * 100 + 
         (myKillPotential - oppKillPotential) * 60 + 
         speedAdvantage + 
         myStatusPenalty + 
         oppStatusPenalty;
}

/**
 * Minimax algorithm to find the best moves for all active Pokémon
 */
export function calculateBestMoves(state: BattleState): MoveRecommendation[] {
  return state.myActiveIndices.map(activeIndex => {
    const me = state.myTeam[activeIndex];
    const opp = state.opponentTeam[state.opponentActiveIndices[0]]; // Target first opponent by default

    const recommendations: MoveRecommendation[] = [];

    if (!me || me.currentHp <= 0) return { type: 'Move', id: 'none', name: 'None', score: 0, reason: 'Fainted' };

    // Evaluate each Move
    me.selectedMoves.forEach(move => {
      const damage = calculateDamage(me, opp, move, state.weather);
      const killPotential = damage / opp.stats.hp;
      const typeEff = getTypeEffectiveness(normalizeMoveType((move as any).type), opp.types);

      let score = killPotential * 100;
      if (typeEff > 1) score += 20;
      if (typeEff < 1) score -= 30;

      if (killPotential >= 1 && me.stats.spe > opp.stats.spe) {
          score += 1000; 
      }

      recommendations.push({
        type: 'Move',
        id: move.id,
        name: move.name,
        score: score,
        reason: `**${me.name}** → **${move.name}**\n- Damage: **${Math.round(damage)}** (~**${Math.round(killPotential * 100)}%**) of **${opp.name}**'s HP\n- Type effectiveness: **${typeEff}x**`
      });
    });

    // Evaluate Switching
    state.myTeam.forEach((p, index) => {
      if (state.myActiveIndices.includes(index) || p.currentHp <= 0) return;

      const tempState = { ...state, myActiveIndices: [index] };
      const switchScore = evaluateState(tempState) - 20;

      recommendations.push({
        type: 'Switch',
        id: p.id,
        name: p.name,
        score: switchScore,
        reason: `${me.name}: Switching to ${p.name} might be safer.`
      });
    });

    return recommendations.sort((a, b) => b.score - a.score)[0];
  });
}
