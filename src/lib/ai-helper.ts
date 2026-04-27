import { BattleState, MoveRecommendation, BattlePokemon } from '../types/pokemon';

type DiscussionMessage = { role: 'user' | 'ai'; text: string };

export function generateAIPrompt(
  state: BattleState,
  recommendations: MoveRecommendation[],
  userContext?: string,
  discussionHistory?: DiscussionMessage[]
): string {
  const format = state.format;
  const myActive = state.myActiveIndices.map(i => state.myTeam[i]);
  const oppActive = state.opponentActiveIndices.map(i => state.opponentTeam[i]);

  const pokemonInfo = (p: BattlePokemon, label: string) => `
${label}: ${p.name}
- Types: ${p.types.join('/')}
- HP: ${p.currentHp}/${p.stats.hp}
- Item: ${p.item || 'None'}
- Status: ${p.status}
- Stats: ATK:${p.stats.atk}, DEF:${p.stats.def}, SPA:${p.stats.spa}, SPD:${p.stats.spd}, SPE:${p.stats.spe}
- Moves: ${p.selectedMoves.map(m => `${m.name} (${m.type})`).join(', ')}`;

  const myTeamInfo = myActive.map((p, i) => pokemonInfo(p, `MY POKEMON ${i + 1}`)).join('\n');
  const oppTeamInfo = oppActive.map((p, i) => {
    return `
OPPONENT POKEMON ${i + 1}: ${p.name}
- Types: ${p.types.join('/')}
- HP: ${p.currentHp}/${p.stats.hp}
- Item: ${p.item || 'Unknown'}
- Status: ${p.status}
- Potential Moves (Meta): ${p.moves.slice(0, 10).join(', ')}`;
  }).join('\n');

  const recInfo = recommendations.map(r => `- Suggestion for ${r.name}: ${r.type} (Score: ${Math.round(r.score)}) - ${r.reason}`).join('\n');
  const history = (discussionHistory || [])
    .filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'ai'))
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'USER' : 'AI'}: ${m.text}`)
    .join('\n');
  const cleanedUserContext = (userContext || '').trim();

  return `
As a Pokémon Battle Expert for "Pokémon Champions", analyze the current turn in a ${format} Battle.

CONTEXT:
- Weather: ${state.weather}
- Turn: ${state.turn}

${myTeamInfo}

${oppTeamInfo}

CURRENT LOGIC SUGGESTIONS:
${recInfo}

${cleanedUserContext ? `USER UPDATES / QUESTIONS:\n${cleanedUserContext}\n` : ''}
${history ? `DISCUSSION HISTORY (latest first):\n${history}\n` : ''}

TASK:
1. Validate if these moves are optimal for a ${format} Battle, considering synergies (e.g. Helping Hand, Follow Me, Spread moves).
2. Predict opponent actions and suggest counter-strategies.
3. Provide a brief, professional strategy for the next 2-3 turns.
`;
}

export function generateTeamPredictionPrompt(state: BattleState): string {
  const format = state.format;
  const myTeamNames = state.myTeam.map(p => `${p.name} (Item: ${p.item || 'None'})`).join(', ');
  const oppTeamNames = state.opponentTeam.map(p => `${p.name} (Item: ${p.item || 'Unknown'})`).join(', ');

  return `
As a Pokémon Battle Expert for "Pokémon Champions", perform a Pre-Battle Analysis for a ${format} Battle.

TEAM DATA:
- MY TEAM (6 Pokémon): ${myTeamNames}
- OPPONENT TEAM (6 Pokémon): ${oppTeamNames}

TASK:
Provide a concise and strategic analysis with the following structure:

1. BRING 4 RECOMMENDATION (MINE):
   - List the 4 Pokémon I should select from my 6 to best counter their team.
   - Explain why these 4 provide the best coverage or synergy.

2. OPPONENT'S LIKELY 4:
   - Predict which 4 Pokémon the opponent is most likely to bring.
   - Briefly explain their likely win condition.

3. STARTING LEAD RECOMMENDATION:
   - Suggest 2 Pokémon for me to Lead with.
   - Predict the opponent's 2 most likely Leads.
   - Explain the turn 1 interaction and why my lead is favorable.

Keep the tone professional, concise, and focused on competitive VGC/Double Battle meta-game.
`;
}
