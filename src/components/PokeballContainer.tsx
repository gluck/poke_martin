import { useState, useCallback, useRef } from 'react';
import type { Player, PendingEvolution, PokeAPIPokemon } from '../types';
import { useGame } from '../context/GameContext';
import { PokemonCard } from './PokemonCard';
import { getEvolutionChain, findNextEvolution } from '../api/evolution';
import { transformApiPokemon } from '../api/pokeapi';
import { lookupFrenchName } from '../api/frenchNames';
import './PokeballContainer.css';

export function PokeballContainer({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [showReserve, setShowReserve] = useState(false);
  const teamListRef = useRef<HTMLDivElement>(null);

  // --- Desktop drag ---
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

  // --- Touch drag (mobile/tablet) ---
  const touchStartIndex = useRef<number | null>(null);

  const getSlotIndexFromTouch = (touch: React.Touch): number | null => {
    if (!teamListRef.current) return null;
    const slots = teamListRef.current.querySelectorAll('.team-slot');
    for (let i = 0; i < slots.length; i++) {
      const rect = slots[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        return i;
      }
    }
    return null;
  };

  const handleTouchStart = (index: number) => {
    touchStartIndex.current = index;
    setDragIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartIndex.current === null) return;
    const idx = getSlotIndexFromTouch(e.touches[0]);
    setOverIndex(idx);
  };

  const handleTouchEnd = () => {
    if (touchStartIndex.current !== null && overIndex !== null && touchStartIndex.current !== overIndex) {
      dispatch({ type: 'REORDER_TEAM', playerId: player.id, fromIndex: touchStartIndex.current, toIndex: overIndex });
    }
    touchStartIndex.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDevLevelUp = useCallback((pokemonId: number) => {
    const poke = player.team.find(p => p.id === pokemonId) || player.reserve.find(p => p.id === pokemonId);
    if (!poke || poke.level >= 100) return;

    const newLevel = poke.level + 1;
    dispatch({ type: 'SET_LEVEL', playerId: player.id, pokemonId, level: newLevel });
    // Check evolution
    if (poke.evolutionChainId > 0) {
      const chain = getEvolutionChain(poke.evolutionChainId);
      if (chain) {
        const nextEvo = findNextEvolution(chain, poke.name);
        if (nextEvo && newLevel >= nextEvo.minLevel) {
          const evoFrenchName = lookupFrenchName(nextEvo.speciesName);
          const evoSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nextEvo.speciesId}.png`;
          const pending: PendingEvolution = {
            playerId: player.id,
            pokemonId: poke.id,
            fromName: poke.name,
            fromFrenchName: poke.frenchName,
            fromSprite: poke.sprite,
            intoSpeciesId: nextEvo.speciesId,
            intoName: nextEvo.speciesName,
            intoFrenchName: evoFrenchName,
            intoSprite: evoSprite,
          };
          setTimeout(() => dispatch({ type: 'SET_PENDING_EVOLUTION', evolution: pending }), 100);
        }
      }
    }
  }, [player, dispatch]);

  const handleEvolve = useCallback(async (pokemonId: number, targetSpeciesId: number) => {
    const poke = player.team.find(p => p.id === pokemonId) || player.reserve.find(p => p.id === pokemonId);
    if (!poke) return;
    const name = poke.frenchName || poke.name;
    if (poke.level > 5) {
      const ok = window.confirm(
        `${name} est Nv. ${poke.level}. L'evolution remettra son niveau a 5. Continuer ?`
      );
      if (!ok) return;
    }
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${targetSpeciesId}`);
      if (!res.ok) return;
      const raw: PokeAPIPokemon = await res.json();
      const evolvedPokemon = await transformApiPokemon(raw);
      dispatch({ type: 'EVOLVE_POKEMON', playerId: player.id, pokemonId, evolvedPokemon });
    } catch { /* ignore */ }
  }, [player, dispatch]);

  return (
    <div className="pokeball-container">
      <div className="pokeball-header">
        <div className="pokeball-icon" />
        <h3>{player.name}</h3>
        <span className="team-count">{player.team.length}/6</span>
        <button
          className="delete-player-btn"
          onClick={() => {
            const total = player.team.length + player.reserve.length;
            const msg = total > 0
              ? `Supprimer ${player.name} et ses ${total} Pokemon ?`
              : `Supprimer ${player.name} ?`;
            if (window.confirm(msg)) {
              dispatch({ type: 'REMOVE_PLAYER', playerId: player.id });
            }
          }}
          title="Supprimer le joueur"
        >
          &times;
        </button>
      </div>

      {player.team.length === 0 ? (
        <p className="empty-team">Pas encore de Pokemon. Cherchez-en et ajoutez-les !</p>
      ) : (
        <div className="team-list" ref={teamListRef}>
          {player.team.map((pokemon, index) => (
            <div
              key={pokemon.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onTouchStart={() => handleTouchStart(index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`team-slot${dragIndex === index ? ' dragging' : ''}${overIndex === index && dragIndex !== index ? ' drag-over' : ''}`}
            >
              <div className="drag-handle" title="Glisser pour reordonner">&#x2630;</div>
              <PokemonCard
                pokemon={pokemon}
                compact
                onRemove={() => dispatch({ type: 'REMOVE_POKEMON', playerId: player.id, pokemonId: pokemon.id })}
                onLevelUp={() => handleDevLevelUp(pokemon.id)}
                onEvolve={(speciesId) => handleEvolve(pokemon.id, speciesId)}
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
                    onLevelUp={() => handleDevLevelUp(pokemon.id)}
                    onEvolve={(speciesId) => handleEvolve(pokemon.id, speciesId)}
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
