import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { PokeballContainer } from './PokeballContainer';
import './PlayerList.css';

export function PlayerList() {
  const { state, dispatch } = useGame();
  const [name, setName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'ADD_PLAYER', name: trimmed });
    setName('');
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
        <button type="submit" className="add-player-btn">
          Ajouter
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
