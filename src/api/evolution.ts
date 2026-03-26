import type { GrowthRate, EvolutionStep } from '../types';

const GROWTH_RATE_CACHE_KEY = 'poke_martin_growth_rates';
const EVOLUTION_CHAIN_CACHE_KEY = 'poke_martin_evolution_chains';

// ---- Growth Rate ----

let growthRateCache: Record<string, GrowthRate> = {};

function loadGrowthRateCache(): Record<string, GrowthRate> {
  try {
    const saved = localStorage.getItem(GROWTH_RATE_CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveGrowthRateCache() {
  try {
    localStorage.setItem(GROWTH_RATE_CACHE_KEY, JSON.stringify(growthRateCache));
  } catch { /* ignore */ }
}

export async function fetchGrowthRate(name: string): Promise<GrowthRate> {
  if (!Object.keys(growthRateCache).length) {
    growthRateCache = loadGrowthRateCache();
  }
  if (growthRateCache[name]) return growthRateCache[name];

  const res = await fetch(`https://pokeapi.co/api/v2/growth-rate/${name}`);
  const data = await res.json();
  const growthRate: GrowthRate = {
    name: data.name,
    levels: data.levels
      .map((l: { level: number; experience: number }) => ({ level: l.level, experience: l.experience }))
      .sort((a: { level: number }, b: { level: number }) => a.level - b.level),
  };
  growthRateCache[name] = growthRate;
  saveGrowthRateCache();
  return growthRate;
}

export function getGrowthRate(name: string): GrowthRate | null {
  if (!Object.keys(growthRateCache).length) {
    growthRateCache = loadGrowthRateCache();
  }
  return growthRateCache[name] || null;
}

export function getXpForLevel(growthRate: GrowthRate, level: number): number {
  const entry = growthRate.levels.find(l => l.level === level);
  return entry?.experience ?? 0;
}

export function getLevelForXp(growthRate: GrowthRate, xp: number): number {
  let level = 1;
  for (const entry of growthRate.levels) {
    if (xp >= entry.experience) {
      level = entry.level;
    } else {
      break;
    }
  }
  return level;
}

export function getXpToNextLevel(growthRate: GrowthRate, currentXp: number, currentLevel: number): { needed: number; progress: number; currentLevelXp: number; nextLevelXp: number } {
  const currentLevelXp = getXpForLevel(growthRate, currentLevel);
  const nextLevelXp = currentLevel < 100 ? getXpForLevel(growthRate, currentLevel + 1) : currentLevelXp;
  const totalNeeded = nextLevelXp - currentLevelXp;
  const progress = totalNeeded > 0 ? (currentXp - currentLevelXp) / totalNeeded : 1;
  return { needed: totalNeeded, progress: Math.min(Math.max(progress, 0), 1), currentLevelXp, nextLevelXp };
}

// ---- Evolution Chains ----

let evolutionChainCache: Record<number, EvolutionStep> = {};

function loadEvolutionChainCache(): Record<number, EvolutionStep> {
  try {
    const saved = localStorage.getItem(EVOLUTION_CHAIN_CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveEvolutionChainCache() {
  try {
    localStorage.setItem(EVOLUTION_CHAIN_CACHE_KEY, JSON.stringify(evolutionChainCache));
  } catch { /* ignore */ }
}

interface RawChainLink {
  species: { name: string; url: string };
  evolution_details: {
    trigger: { name: string };
    min_level: number | null;
  }[];
  evolves_to: RawChainLink[];
}

function parseChainLink(link: RawChainLink): EvolutionStep {
  const speciesUrl = link.species.url;
  const speciesId = parseInt(speciesUrl.split('/').filter(Boolean).pop()!, 10);

  return {
    speciesName: link.species.name,
    speciesId,
    minLevel: link.evolution_details?.[0]?.min_level ?? null,
    evolvesTo: link.evolves_to.map(child => parseChainLink(child)),
  };
}

export async function fetchEvolutionChain(chainId: number): Promise<EvolutionStep> {
  if (!Object.keys(evolutionChainCache).length) {
    evolutionChainCache = loadEvolutionChainCache();
  }
  if (evolutionChainCache[chainId]) return evolutionChainCache[chainId];

  const res = await fetch(`https://pokeapi.co/api/v2/evolution-chain/${chainId}`);
  const data = await res.json();
  const chain = parseChainLink(data.chain);
  evolutionChainCache[chainId] = chain;
  saveEvolutionChainCache();
  return chain;
}

export function getEvolutionChain(chainId: number): EvolutionStep | null {
  if (!Object.keys(evolutionChainCache).length) {
    evolutionChainCache = loadEvolutionChainCache();
  }
  return evolutionChainCache[chainId] || null;
}

function findInChain(step: EvolutionStep, speciesName: string): EvolutionStep | null {
  if (step.speciesName === speciesName) return step;
  for (const child of step.evolvesTo) {
    const found = findInChain(child, speciesName);
    if (found) return found;
  }
  // Fallback: try matching by base name (e.g. "urshifu-single-strike" matches "urshifu")
  const dashIdx = speciesName.indexOf('-');
  if (dashIdx > 0) {
    const baseName = speciesName.substring(0, dashIdx);
    if (step.speciesName === baseName) return step;
    for (const child of step.evolvesTo) {
      const found = findInChain(child, baseName);
      if (found) return found;
    }
  }
  return null;
}

export function findNextEvolution(
  chain: EvolutionStep,
  speciesName: string
): { speciesId: number; speciesName: string; minLevel: number } | null {
  const current = findInChain(chain, speciesName);
  if (!current || current.evolvesTo.length === 0) return null;

  // Only consider level-based evolutions
  for (const next of current.evolvesTo) {
    if (next.minLevel && next.minLevel > 0) {
      return {
        speciesId: next.speciesId,
        speciesName: next.speciesName,
        minLevel: next.minLevel,
      };
    }
  }
  return null;
}

export function getAllChainSpeciesIds(chainId: number): number[] {
  const chain = getEvolutionChain(chainId);
  if (!chain) return [];
  const ids: number[] = [];
  function collect(step: EvolutionStep) {
    ids.push(step.speciesId);
    step.evolvesTo.forEach(collect);
  }
  collect(chain);
  return ids;
}

export interface EvolutionNeighborEntry {
  speciesId: number;
  speciesName: string;
  label?: string;  // "Mega", "Mega X", etc. — undefined for regular evolutions
}

export interface EvolutionNeighbors {
  prev: EvolutionNeighborEntry | null;
  next: EvolutionNeighborEntry[];
  megas: EvolutionNeighborEntry[];
}

function findParentInChain(step: EvolutionStep, speciesName: string, parent: EvolutionStep | null): EvolutionStep | null {
  if (step.speciesName === speciesName) return parent;
  for (const child of step.evolvesTo) {
    const found = findParentInChain(child, speciesName, step);
    if (found) return found;
  }
  // Fallback: try base name
  const dashIdx = speciesName.indexOf('-');
  if (dashIdx > 0) {
    const baseName = speciesName.substring(0, dashIdx);
    if (step.speciesName === baseName) return parent;
    for (const child of step.evolvesTo) {
      const found = findParentInChain(child, baseName, step);
      if (found) return found;
    }
  }
  return null;
}

// Check if a pokemon name is a non-default variant by scanning all cached varieties
function isVariantForm(pokemonName: string): boolean {
  if (!Object.keys(varietiesCache).length) {
    varietiesCache = loadVarietiesCache();
  }
  for (const varieties of Object.values(varietiesCache)) {
    if (varieties.some(v => v.name === pokemonName)) return true;
  }
  return false;
}

// Find the base species for a variant pokemon name by scanning all cached varieties
function findBaseSpeciesForVariant(variantName: string): { speciesId: number; speciesName: string } | null {
  if (!Object.keys(varietiesCache).length) {
    varietiesCache = loadVarietiesCache();
  }
  for (const [speciesIdStr, varieties] of Object.entries(varietiesCache)) {
    const match = varieties.find(v => v.name === variantName);
    if (match) {
      const speciesId = parseInt(speciesIdStr, 10);
      // Base name: remove the variant suffix (everything after the first dash that makes it a variant)
      // Find the default form name from the chain or derive from the variant name
      const dashIdx = variantName.indexOf('-');
      const baseName = dashIdx > 0 ? variantName.substring(0, dashIdx) : variantName;
      return { speciesId, speciesName: baseName };
    }
  }
  return null;
}

export function getEvolutionNeighbors(chainId: number, speciesName: string, speciesId?: number): EvolutionNeighbors {
  const chain = getEvolutionChain(chainId);

  // If it's any variant form (mega, gmax, crowned, etc.), show base as prev
  if (isVariantForm(speciesName)) {
    const base = findBaseSpeciesForVariant(speciesName);
    return {
      prev: base ? { speciesId: base.speciesId, speciesName: base.speciesName } : null,
      next: [],
      megas: [],
    };
  }

  // Get mega/alternate forms for this species (always, even without chain)
  const megas: EvolutionNeighborEntry[] = [];
  if (speciesId) {
    const varieties = getVarieties(speciesId);
    for (const v of varieties) {
      megas.push({ speciesId: v.pokemonId, speciesName: v.name, label: v.label });
    }
  }

  if (!chain) return { prev: null, next: [], megas };

  const current = findInChain(chain, speciesName);
  const parent = findParentInChain(chain, speciesName, null);

  const prev: EvolutionNeighborEntry | null = parent
    ? { speciesId: parent.speciesId, speciesName: parent.speciesName }
    : null;

  const next = current?.evolvesTo.map(e => ({ speciesId: e.speciesId, speciesName: e.speciesName })) ?? [];

  return { prev, next, megas };
}

// ---- Varieties (Mega evolutions, alternate forms) ----

export interface PokemonVariety {
  pokemonId: number;
  name: string;
  isDefault: boolean;
  isMega: boolean;
  label: string; // e.g. "Mega", "Mega X", "Mega Y", "Gmax"
}

const VARIETIES_CACHE_KEY = 'poke_martin_varieties';
let varietiesCache: Record<number, PokemonVariety[]> = {};

function loadVarietiesCache(): Record<number, PokemonVariety[]> {
  try {
    const saved = localStorage.getItem(VARIETIES_CACHE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveVarietiesCache() {
  try {
    localStorage.setItem(VARIETIES_CACHE_KEY, JSON.stringify(varietiesCache));
  } catch { /* ignore */ }
}

function parseVarietyLabel(name: string, baseName: string): string {
  const suffix = name.replace(baseName + '-', '');
  if (suffix === 'mega') return 'Mega';
  if (suffix === 'mega-x') return 'Mega X';
  if (suffix === 'mega-y') return 'Mega Y';
  if (suffix === 'gmax') return 'Gmax';
  if (suffix.startsWith('mega')) return 'Mega ' + suffix.replace('mega-', '').toUpperCase();
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

export function getVarieties(speciesId: number): PokemonVariety[] {
  if (!Object.keys(varietiesCache).length) {
    varietiesCache = loadVarietiesCache();
  }
  return varietiesCache[speciesId] ?? [];
}

// ---- Species data fetching ----

export async function fetchSpeciesData(speciesIdOrUrl: number | string): Promise<{ growthRateId: string; evolutionChainId: number }> {
  const url = typeof speciesIdOrUrl === 'string'
    ? speciesIdOrUrl
    : `https://pokeapi.co/api/v2/pokemon-species/${speciesIdOrUrl}`;
  const res = await fetch(url);
  const data = await res.json();
  const growthRateId = data.growth_rate?.name ?? 'medium';
  const chainUrl: string = data.evolution_chain?.url ?? '';
  const evolutionChainId = parseInt(chainUrl.split('/').filter(Boolean).pop()!, 10) || 0;

  // Parse varieties (mega evolutions, alternate forms)
  if (!Object.keys(varietiesCache).length) {
    varietiesCache = loadVarietiesCache();
  }
  if (data.varieties && data.varieties.length > 1) {
    const baseName = data.name;
    const varieties: PokemonVariety[] = data.varieties.map((v: { is_default: boolean; pokemon: { name: string; url: string } }) => {
      const pokemonUrl = v.pokemon.url;
      const pokemonId = parseInt(pokemonUrl.split('/').filter(Boolean).pop()!, 10);
      const isMega = v.pokemon.name.includes('-mega');
      return {
        pokemonId,
        name: v.pokemon.name,
        isDefault: v.is_default,
        isMega,
        label: v.is_default ? 'Normal' : parseVarietyLabel(v.pokemon.name, baseName),
      };
    });
    varietiesCache[data.id] = varieties.filter(v => !v.isDefault);
    saveVarietiesCache();
  }

  return { growthRateId, evolutionChainId };
}
