export type PokemonType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Electric'
  | 'Grass'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Bug'
  | 'Rock'
  | 'Ghost'
  | 'Dragon'
  | 'Steel'
  | 'Dark'
  | 'Fairy';

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Move {
  id: string;
  name: string;
  type: PokemonType;
  category: 'Physical' | 'Special' | 'Status';
  power?: number;
  accuracy?: number;
  pp: number;
  description: string;
  priority: number;
}

export interface Ability {
  name: string;
  description: string;
}

export interface Pokemon {
  id: string;
  name: string;
  pokedexNumber?: number;
  types: PokemonType[];
  stats: Stats;
  bst: number;
  abilities: Ability[];
  moves: string[]; // Full movepool names
  learnset?: string[]; // Optional specific IDs
  tier?: string;
  imageUrl?: string;
}

export type Weather = 'None' | 'Harsh Sunlight' | 'Rain' | 'Sandstorm' | 'Snow';

export type StatusCondition = 'None' | 'Burn' | 'Paralysis' | 'Poison' | 'Toxic' | 'Sleep' | 'Freeze';

export interface BattlePokemon extends Pokemon {
  currentHp: number;
  selectedMoves: Move[];
  activeAbility?: Ability;
  nature?: string;
  evs?: Partial<Stats>;
  item?: string;
  status: StatusCondition;
  toxicCounter: number;
  statStages: {
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
}

export type BattleFormat = 'Single' | 'Double';

export interface BattleState {
  format: BattleFormat;
  myActiveIndices: number[];
  opponentActiveIndices: number[];
  myTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[];
  weather: Weather;
  turn: number;
}

export interface MoveRecommendation {
  type: 'Move' | 'Switch';
  id: string; // moveId or pokemonId
  name: string;
  score: number;
  reason: string;
}
