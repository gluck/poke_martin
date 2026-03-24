import { useState, useRef, useCallback } from 'react';
import type { Pokemon } from '../types';
import { searchPokemonByPartial } from '../api/pokeapi';

export function usePokemonSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, Pokemon[]>());
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.toLowerCase().trim();
    setQuery(searchQuery);

    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }

    if (cache.current.has(trimmed)) {
      setResults(cache.current.get(trimmed)!);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const found = await searchPokemonByPartial(trimmed);
      cache.current.set(trimmed, found);
      setResults(found);
      if (found.length === 0) setError('Aucun Pokemon trouve');
    } catch {
      setError('Echec de la recherche');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { query, results, loading, error, search, setQuery };
}
