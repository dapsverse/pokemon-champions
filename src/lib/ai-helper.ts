import { BattleState, MoveRecommendation, BattlePokemon } from '../types/pokemon';

type DiscussionMessage = { role: 'user' | 'ai'; text: string };

export function generateAIPrompt(
  state: BattleState,
  recommendations: MoveRecommendation[],
  userContext?: string,
  discussionHistory?: DiscussionMessage[],
  availableItems?: string[]
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

  const itemConstraint = availableItems ? `\nITEM RESTRICTION: Opponent items can ONLY be from this list: ${availableItems.join(', ')} (plus any relevant Mega Stones).` : '';

  return `
As a Pokémon Battle Expert for "Pokémon Champions", analyze the current turn in a ${format} Battle.

CONTEXT:
- Weather: ${state.weather}
- Turn: ${state.turn}
${itemConstraint}

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

export function generateTeamPredictionPrompt(state: BattleState, battleHistory?: string, availableItems?: string[]): string {
  const format = state.format;
  const myTeamNames = state.myTeam.map(p => `${p.name} (Item: ${p.item || 'None'})`).join(', ');
  const oppTeamNames = state.opponentTeam.map(p => `${p.name} (Item: ${p.item || 'Unknown'})`).join(', ');

  const itemConstraint = availableItems ? `\nITEM RESTRICTION: When predicting opponent items, ONLY use items from this list: ${availableItems.join(', ')} (or relevant Mega Stones).` : '';

  return `
As a Pokémon Battle Expert for "Pokémon Champions", perform a Battle Analysis for a ${format} Battle.

TEAM DATA:
- MY TEAM: ${myTeamNames}
- OPPONENT TEAM: ${oppTeamNames}
${itemConstraint}

${battleHistory ? `BATTLE PROGRESS SO FAR:\n${battleHistory}\n` : ''}

STRATEGIC CONSIDERATIONS:
1. MEGA EVOLUTION: Opponent Pokémon might hold Mega Stones. For example, a Delphox could be a Mega Delphox. Always consider the highest threat version of a Pokémon.
2. PRIORITY & DEFENSIVE MOVES: Always account for priority moves (e.g., Sucker Punch, Extreme Speed, Fake Out) and defensive/counter moves (e.g., Protect, Focus Sash, Counter, Mirror Coat). 
3. PREDICTIVE PLAY: Analyze how the opponent might react to my moves and suggest ways to outplay them.

TASK:
Provide a concise and strategic analysis:

1. BRING 4 RECOMMENDATION (MINE):
   - List the 4 Pokémon I should select (or are currently active) to best counter their team.
   - Explain why these provide the best coverage or synergy.

2. OPPONENT'S LIKELY 4 & WIN CONDITION:
   - Predict which 4 Pokémon the opponent will bring/use.
   - Identify their primary win condition and how to disrupt it.

3. NEXT STEPS / LEAD RECOMMENDATION:
   - If starting: Suggest 2 Leads and predict their Leads.
   - If mid-battle: Suggest the best moves/switches for the current turn based on the Battle Progress.
   - Explain priority interactions (e.g., "Watch out for Sucker Punch from Kingambit if you attack").

Keep the tone professional, concise, and focused on high-level competitive play.
`;
}
