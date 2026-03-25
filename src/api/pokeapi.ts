import type { PokeAPIPokemon, PokeAPIListResponse, Pokemon, PokemonStats } from '../types';
import { lookupFrenchName, searchFrenchIndex, getFrenchNameIndex } from './frenchNames';
import { fetchSpeciesData, fetchGrowthRate, fetchEvolutionChain, getXpForLevel } from './evolution';
import { fetchAbilitiesFrenchNames } from './abilities';

const BASE_URL = 'https://pokeapi.co/api/v2';

// Cache French form names (e.g. "urshifu-single-strike" → "Shifours Style Poing Final")
const FORM_NAMES_CACHE_KEY = 'poke_martin_form_names_fr';
let formNamesCache: Record<string, string> = {};

function loadFormNamesCache() {
  if (Object.keys(formNamesCache).length) return;
  try {
    const saved = localStorage.getItem(FORM_NAMES_CACHE_KEY);
    if (saved) formNamesCache = JSON.parse(saved);
  } catch { /* ignore */ }
}

function saveFormNamesCache() {
  try {
    localStorage.setItem(FORM_NAMES_CACHE_KEY, JSON.stringify(formNamesCache));
  } catch { /* ignore */ }
}

async function fetchFormFrenchName(formUrl: string, pokemonName: string): Promise<string | null> {
  loadFormNamesCache();
  if (formNamesCache[pokemonName]) return formNamesCache[pokemonName];

  try {
    const res = await fetch(formUrl);
    if (!res.ok) return null;
    const data = await res.json();
    // Use `names` array which has the full localized name (e.g. "Shifours Style Poing Final")
    const frEntry = data.names?.find((n: { language: { name: string }; name: string }) => n.language.name === 'fr');
    if (frEntry?.name) {
      formNamesCache[pokemonName] = frEntry.name;
      saveFormNamesCache();
      return frEntry.name;
    }
  } catch { /* ignore */ }
  return null;
}

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
    const [species, frenchAbilities] = await Promise.all([
      fetchSpeciesData(raw.species?.url || raw.id),
      fetchAbilitiesFrenchNames(raw.abilities.map(a => a.ability.name)),
    ]);
    base.growthRateId = species.growthRateId;
    base.evolutionChainId = species.evolutionChainId;
    base.abilities = frenchAbilities;
    const growthRate = await fetchGrowthRate(species.growthRateId);
    base.currentXp = getXpForLevel(growthRate, base.level);
    if (species.evolutionChainId > 0) {
      await fetchEvolutionChain(species.evolutionChainId);
    }
    // Fetch French form name for variants (e.g. urshifu-single-strike → "Shifours Style Poing Final")
    if (raw.name !== raw.species?.name && raw.forms?.length) {
      const formUrl = raw.forms[0]?.url;
      if (formUrl) {
        const formName = await fetchFormFrenchName(formUrl, raw.name);
        if (formName) base.frenchName = formName;
      }
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
