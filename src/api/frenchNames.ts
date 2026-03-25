import type { FrenchNameEntry } from '../types';

const STORAGE_KEY = 'poke_martin_french_names';
const SPECIES_LIST_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=1302';

let nameIndex: FrenchNameEntry[] | null = null;
let loadingPromise: Promise<FrenchNameEntry[]> | null = null;

function loadFromStorage(): FrenchNameEntry[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(entries: FrenchNameEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

async function fetchSpeciesFrenchName(url: string): Promise<FrenchNameEntry | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const frEntry = data.names?.find((n: { language: { name: string }; name: string }) => n.language.name === 'fr');
    return {
      id: data.id,
      englishName: data.name,
      frenchName: frEntry?.name ?? data.name,
    };
  } catch {
    return null;
  }
}

async function buildIndex(): Promise<FrenchNameEntry[]> {
  // Fetch species list
  const listRes = await fetch(SPECIES_LIST_URL);
  const list = await listRes.json();
  const speciesList: { name: string; url: string }[] = list.results;

  // Fetch in batches of 50 to avoid overwhelming the browser
  const entries: FrenchNameEntry[] = [];
  const batchSize = 50;
  for (let i = 0; i < speciesList.length; i += batchSize) {
    const batch = speciesList.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(s => fetchSpeciesFrenchName(s.url)));
    for (const r of results) {
      if (r) entries.push(r);
    }
  }

  saveToStorage(entries);
  return entries;
}

export async function getFrenchNameIndex(): Promise<FrenchNameEntry[]> {
  if (nameIndex) return nameIndex;

  const cached = loadFromStorage();
  if (cached && cached.length > 0) {
    nameIndex = cached;
    return cached;
  }

  if (!loadingPromise) {
    loadingPromise = buildIndex().then(entries => {
      nameIndex = entries;
      loadingPromise = null;
      return entries;
    });
  }

  return loadingPromise;
}

export function getFrenchNameIndexSync(): FrenchNameEntry[] | null {
  if (nameIndex) return nameIndex;
  const cached = loadFromStorage();
  if (cached && cached.length > 0) {
    nameIndex = cached;
    return cached;
  }
  return null;
}

export function lookupFrenchName(englishName: string): string {
  if (!nameIndex) return englishName;
  // Exact match first
  const entry = nameIndex.find(e => e.englishName === englishName);
  if (entry) return entry.frenchName;
  // Fallback: try base name (before form suffix) e.g. "urshifu-single-strike" → "urshifu"
  const dashIdx = englishName.indexOf('-');
  if (dashIdx > 0) {
    const baseName = englishName.substring(0, dashIdx);
    const baseEntry = nameIndex.find(e => e.englishName === baseName);
    if (baseEntry) return baseEntry.frenchName;
  }
  return englishName;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function searchFrenchIndex(query: string): FrenchNameEntry[] {
  if (!nameIndex) return [];
  const q = stripAccents(query.toLowerCase());
  return nameIndex.filter(
    e => stripAccents(e.frenchName.toLowerCase()).includes(q) || stripAccents(e.englishName.toLowerCase()).includes(q)
  );
}
