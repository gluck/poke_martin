import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { PokeballContainer } from './PokeballContainer';
import { transformApiPokemon } from '../api/pokeapi';
import { STARTER_IDS } from '../data/regions';
import type { PokeAPIPokemon } from '../types';
import './PlayerList.css';

export function PlayerList() {
  const { state, dispatch } = useGame();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || loading) return;
    setLoading(true);

    try {
      const starterId = STARTER_IDS[Math.floor(Math.random() * STARTER_IDS.length)];
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${starterId}`);
      if (!res.ok) throw new Error('fetch failed');
      const raw: PokeAPIPokemon = await res.json();
      const starter = await transformApiPokemon(raw);
      dispatch({ type: 'ADD_PLAYER', name: trimmed, starterPokemon: starter });
    } catch {
      // Fallback: create player without starter
      dispatch({ type: 'ADD_PLAYER', name: trimmed });
    }
    setName('');
    setLoading(false);
  };

  return (
    <section className="player-list">
      <h2>Joueurs</h2>
      <form onSubmit={handleAdd} className="add-player-form">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom du joueur..."
          className="player-input"
        />
        <button type="submit" className="add-player-btn" disabled={loading}>
          {loading ? '...' : 'Ajouter'}
        </button>
      </form>
      {state.players.length === 0 ? (
        <p className="no-players">Aucun joueur pour le moment. Ajoutez-en pour commencer !</p>
      ) : (
        <div className="players-grid">
          {state.players.map(player => (
            <PokeballContainer key={player.id} player={player} />
          ))}
        </div>
      )}
    </section>
  );
}
