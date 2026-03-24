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

// ---- Species data fetching ----

export async function fetchSpeciesData(speciesId: number): Promise<{ growthRateId: string; evolutionChainId: number }> {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
  const data = await res.json();
  const growthRateId = data.growth_rate?.name ?? 'medium';
  const chainUrl: string = data.evolution_chain?.url ?? '';
  const evolutionChainId = parseInt(chainUrl.split('/').filter(Boolean).pop()!, 10) || 0;
  return { growthRateId, evolutionChainId };
}
