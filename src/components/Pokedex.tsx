import { useState, useCallback } from 'react';
import { usePokemonSearch } from '../hooks/usePokemonSearch';
import { PokemonCard } from './PokemonCard';
import { transformApiPokemon } from '../api/pokeapi';
import type { Pokemon, PokeAPIPokemon } from '../types';
import './Pokedex.css';

export function Pokedex() {
  const { results, loading, error, search } = usePokemonSearch();
  const [input, setInput] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(input);
    setSelectedPokemon(null);
  };

  const handleNavigate = useCallback(async (speciesId: number) => {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
      if (!res.ok) return;
      const raw: PokeAPIPokemon = await res.json();
      const poke = await transformApiPokemon(raw);
      setSelectedPokemon(poke);
    } catch { /* ignore */ }
  }, []);

  const displayList = selectedPokemon ? [selectedPokemon] : results;

  return (
    <section className="pokedex">
      <h2>Pokedex</h2>
      <form onSubmit={handleSearch} className="pokedex-search-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Chercher un Pokemon..."
          className="pokedex-search-input"
        />
        <button type="submit" className="pokedex-search-btn" disabled={loading}>
          {loading ? 'Recherche...' : 'Chercher'}
        </button>
      </form>
      {selectedPokemon && (
        <button className="pokedex-back" onClick={() => setSelectedPokemon(null)}>
          ← Retour aux resultats
        </button>
      )}
      {error && !selectedPokemon && <p className="pokedex-error">{error}</p>}
      <div className="pokedex-results">
        {displayList.map(pokemon => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
            onEvolve={handleNavigate}
            hideLevel
          />
        ))}
      </div>
    </section>
  );
}
