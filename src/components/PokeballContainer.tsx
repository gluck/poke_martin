import { useState } from 'react';
import type { Player } from '../types';
import { useGame } from '../context/GameContext';
import { PokemonCard } from './PokemonCard';
import './PokeballContainer.css';

export function PokeballContainer({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [showReserve, setShowReserve] = useState(false);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      dispatch({ type: 'REORDER_TEAM', playerId: player.id, fromIndex: dragIndex, toIndex: index });
    }
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="pokeball-container">
      <div className="pokeball-header">
        <div className="pokeball-icon" />
        <h3>{player.name}</h3>
        <span className="team-count">{player.team.length}/6</span>
        <button
          className="delete-player-btn"
          onClick={() => dispatch({ type: 'REMOVE_PLAYER', playerId: player.id })}
          title="Supprimer le joueur"
        >
          &times;
        </button>
      </div>

      {player.team.length === 0 ? (
        <p className="empty-team">Pas encore de Pokemon. Cherchez-en et ajoutez-les !</p>
      ) : (
        <div className="team-list">
          {player.team.map((pokemon, index) => (
            <div
              key={pokemon.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`team-slot${dragIndex === index ? ' dragging' : ''}${overIndex === index && dragIndex !== index ? ' drag-over' : ''}`}
            >
              <div className="drag-handle" title="Glisser pour reordonner">&#x2630;</div>
              <PokemonCard
                pokemon={pokemon}
                compact
                onRemove={() => dispatch({ type: 'REMOVE_POKEMON', playerId: player.id, pokemonId: pokemon.id })}
              />
              <button
                className="move-btn to-reserve"
                onClick={() => dispatch({ type: 'MOVE_TO_RESERVE', playerId: player.id, pokemonId: pokemon.id })}
                title="Mettre en reserve"
              >
                ↓
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reserve section */}
      <div className="reserve-section">
        <button
          className="reserve-toggle"
          onClick={() => setShowReserve(!showReserve)}
        >
          <span className="reserve-toggle-icon">{showReserve ? '▼' : '▶'}</span>
          Reserve ({player.reserve.length})
        </button>
        {showReserve && (
          <div className="reserve-list">
            {player.reserve.length === 0 ? (
              <p className="empty-reserve">Reserve vide</p>
            ) : (
              player.reserve.map(pokemon => (
                <div key={pokemon.id} className="reserve-slot">
                  <PokemonCard
                    pokemon={pokemon}
                    compact
                    onRemove={() => dispatch({ type: 'REMOVE_FROM_RESERVE', playerId: player.id, pokemonId: pokemon.id })}
                  />
                  <button
                    className="move-btn to-team"
                    onClick={() => dispatch({ type: 'MOVE_TO_TEAM', playerId: player.id, pokemonId: pokemon.id })}
                    title="Ajouter a l'equipe"
                    disabled={player.team.length >= 6}
                  >
                    ↑
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
