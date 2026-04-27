import { PokemonType, Weather } from '../types/pokemon';

export function calculateWeatherDamageModifier(
  moveType: PokemonType,
  weather: Weather
): number {
  if (weather === 'Rain') {
    if (moveType === 'Water') return 1.5;
    if (moveType === 'Fire') return 0.5;
  }
  if (weather === 'Harsh Sunlight') {
    if (moveType === 'Fire') return 1.5;
    if (moveType === 'Water') return 0.5;
  }
  return 1.0;
}

export function calculateWeatherStatModifier(
  pokemonTypes: PokemonType[],
  weather: Weather,
  stat: 'def' | 'spd'
): number {
  if (weather === 'Sandstorm' && stat === 'spd' && pokemonTypes.includes('Rock')) {
    return 1.5;
  }
  if (weather === 'Snow' && stat === 'def' && pokemonTypes.includes('Ice')) {
    return 1.5;
  }
  return 1.0;
}

export function isPokemonImmuneToSandstorm(pokemonTypes: PokemonType[]): boolean {
  const sandstormImmuneTypes: PokemonType[] = ['Rock', 'Ground', 'Steel'];
  return pokemonTypes.some((t) => sandstormImmuneTypes.includes(t));
}
