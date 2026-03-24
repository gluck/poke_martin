const STORAGE_KEY = 'poke_martin_abilities_fr';

let cache: Record<string, string> = {};
let loaded = false;

function loadCache() {
  if (loaded) return;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) cache = JSON.parse(saved);
  } catch { /* ignore */ }
  loaded = true;
}

function saveCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export async function fetchAbilityFrenchName(englishName: string): Promise<string> {
  loadCache();
  if (cache[englishName]) return cache[englishName];

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/ability/${englishName}`);
    if (!res.ok) return englishName;
    const data = await res.json();
    const frEntry = data.names?.find(
      (n: { language: { name: string }; name: string }) => n.language.name === 'fr'
    );
    const frName = frEntry?.name ?? englishName;
    cache[englishName] = frName;
    saveCache();
    return frName;
  } catch {
    return englishName;
  }
}

export async function fetchAbilitiesFrenchNames(englishNames: string[]): Promise<string[]> {
  loadCache();
  const results = await Promise.all(
    englishNames.map(name => fetchAbilityFrenchName(name))
  );
  return results;
}

export function lookupAbilityFrench(englishName: string): string {
  loadCache();
  return cache[englishName] ?? englishName.replace(/-/g, ' ');
}
