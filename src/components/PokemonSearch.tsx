import { useState } from 'react';
import { usePokemonSearch } from '../hooks/usePokemonSearch';
import { useGame } from '../context/GameContext';
import { PokemonCard } from './PokemonCard';
import './PokemonSearch.css';

export function PokemonSearch() {
  const { results, loading, error, search } = usePokemonSearch();
  const { state, dispatch } = useGame();
  const [input, setInput] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(input);
  };

  return (
    <section className="pokemon-search">
      <h2>Rechercher un Pokemon</h2>
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Chercher par nom (ex: pikachu, sala...)"
          className="search-input"
        />
        <button type="submit" className="search-btn" disabled={loading}>
          {loading ? 'Recherche...' : 'Chercher'}
        </button>
      </form>
      {error && <p className="search-error">{error}</p>}
      <div className="search-results">
        {results.map(pokemon => (
          <PokemonCard
            key={pokemon.id}
            pokemon={pokemon}
            players={state.players}
            onAddToPlayer={(playerId) =>
              dispatch({ type: 'ADD_POKEMON', playerId, pokemon })
            }
          />
        ))}
      </div>
    </section>
  );
}
