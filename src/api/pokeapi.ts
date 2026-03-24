import type { PokeAPIPokemon, PokeAPIListResponse, Pokemon, PokemonStats } from '../types';
import { lookupFrenchName, searchFrenchIndex, getFrenchNameIndex } from './frenchNames';
import { fetchSpeciesData, fetchGrowthRate, fetchEvolutionChain, getXpForLevel } from './evolution';

const BASE_URL = 'https://pokeapi.co/api/v2';

function mapStats(stats: PokeAPIPokemon['stats']): PokemonStats {
  const get = (name: string) => stats.find(s => s.stat.name === name)?.base_stat ?? 0;
  return {
    hp: get('hp'),
    attack: get('attack'),
    defense: get('defense'),
    spAtk: get('special-attack'),
    spDef: get('special-defense'),
    speed: get('speed'),
  };
}

export function transformApiPokemonSync(raw: PokeAPIPokemon): Pokemon {
  return {
    id: raw.id,
    name: raw.name,
    frenchName: lookupFrenchName(raw.name),
    sprite: raw.sprites.other['official-artwork'].front_default || raw.sprites.front_default,
    types: raw.types.map(t => t.type.name),
    stats: mapStats(raw.stats),
    abilities: raw.abilities.map(a => a.ability.name),
    cryUrl: raw.cries?.latest || null,
    baseExperience: raw.base_experience ?? 50,
    level: 5,
    currentXp: 0,
    growthRateId: 'medium',
    evolutionChainId: 0,
  };
}

export async function transformApiPokemon(raw: PokeAPIPokemon): Promise<Pokemon> {
  const base = transformApiPokemonSync(raw);
  try {
    const species = await fetchSpeciesData(raw.id);
    base.growthRateId = species.growthRateId;
    base.evolutionChainId = species.evolutionChainId;
    // Pre-fetch and cache growth rate and evolution chain
    const growthRate = await fetchGrowthRate(species.growthRateId);
    base.currentXp = getXpForLevel(growthRate, base.level);
    if (species.evolutionChainId > 0) {
      await fetchEvolutionChain(species.evolutionChainId);
    }
  } catch { /* species data is optional enrichment */ }
  return base;
}

export async function searchPokemon(query: string): Promise<Pokemon | null> {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`${BASE_URL}/pokemon/${encodeURIComponent(trimmed)}`);
    if (!res.ok) return null;
    const data: PokeAPIPokemon = await res.json();
    return await transformApiPokemon(data);
  } catch {
    return null;
  }
}

export async function listPokemon(limit = 20, offset = 0): Promise<PokeAPIListResponse> {
  const res = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`);
  return res.json();
}

export async function searchPokemonByPartial(query: string): Promise<Pokemon[]> {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) return [];

  // Ensure French name index is loaded
  await getFrenchNameIndex();

  // Search French index first (matches both French and English names)
  const frenchMatches = searchFrenchIndex(trimmed).slice(0, 12);

  if (frenchMatches.length > 0) {
    const results = await Promise.all(
      frenchMatches.map(async m => {
        try {
          const res = await fetch(`${BASE_URL}/pokemon/${m.id}`);
          if (!res.ok) return null;
          const data: PokeAPIPokemon = await res.json();
          return await transformApiPokemon(data);
        } catch {
          return null;
        }
      })
    );
    return results.filter((p): p is Pokemon => p !== null);
  }

  // Fallback: try exact English name match
  const exact = await searchPokemon(trimmed);
  if (exact) return [exact];

  return [];
}
