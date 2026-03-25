// Server-side growth rate cache (in-memory per invocation, fetches from PokeAPI)
const cache: Record<string, { level: number; experience: number }[]> = {};

export async function getGrowthRateLevels(name: string): Promise<{ level: number; experience: number }[]> {
  if (cache[name]) return cache[name];

  const res = await fetch(`https://pokeapi.co/api/v2/growth-rate/${name}`);
  if (!res.ok) return [];
  const data = await res.json();
  const levels = (data.levels as { level: number; experience: number }[])
    .sort((a, b) => a.level - b.level);
  cache[name] = levels;
  return levels;
}

export function getLevelForXp(levels: { level: number; experience: number }[], xp: number): number {
  let level = 1;
  for (const entry of levels) {
    if (xp >= entry.experience) level = entry.level;
    else break;
  }
  return level;
}

export function getXpForLevel(levels: { level: number; experience: number }[], level: number): number {
  return levels.find(l => l.level === level)?.experience ?? 0;
}
