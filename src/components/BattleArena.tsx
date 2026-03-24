import { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { executeBattle } from '../utils/battle';
import { BattleLog } from './BattleLog';
import { getEvolutionChain, findNextEvolution } from '../api/evolution';
import { lookupFrenchName } from '../api/frenchNames';
import type { PendingEvolution } from '../types';
import './BattleArena.css';

export function BattleArena() {
  const { state, dispatch } = useGame();
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [error, setError] = useState('');

  const eligiblePlayers = state.players.filter(p => p.team.length > 0);

  const handleFight = () => {
    setError('');
    if (!player1Id || !player2Id) {
      setError('Selectionnez deux joueurs');
      return;
    }
    if (player1Id === player2Id) {
      setError('Choisissez deux joueurs differents');
      return;
    }
    const p1 = state.players.find(p => p.id === player1Id);
    const p2 = state.players.find(p => p.id === player2Id);
    if (!p1 || !p2) return;

    const result = executeBattle(p1, p2);
    dispatch({ type: 'SET_BATTLE_RESULT', result });
  };

  const handleXpAwarded = useCallback(() => {
    const battle = state.currentBattle;
    if (!battle?.winner || !battle.xpGains.length) return;

    const winnerId = battle.winner.id;

    // Apply XP to each winning pokemon
    for (const gain of battle.xpGains) {
      dispatch({ type: 'GAIN_XP', playerId: winnerId, pokemonId: gain.pokemonId, xp: gain.xp });
    }

    // Check for evolutions after XP is applied
    setTimeout(() => {
      const winnerPlayer = state.players.find(p => p.id === winnerId);
      if (!winnerPlayer) return;

      for (const gain of battle.xpGains) {
        if (gain.newLevel <= gain.oldLevel) continue;
        const poke = winnerPlayer.team.find(p => p.id === gain.pokemonId);
        if (!poke || poke.evolutionChainId <= 0) continue;

        const chain = getEvolutionChain(poke.evolutionChainId);
        if (!chain) continue;

        const nextEvo = findNextEvolution(chain, poke.name);
        if (!nextEvo || gain.newLevel < nextEvo.minLevel) continue;

        // Fetch sprite for the evolved form
        const evoFrenchName = lookupFrenchName(nextEvo.speciesName);
        const evoSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${nextEvo.speciesId}.png`;

        const pending: PendingEvolution = {
          playerId: winnerId,
          pokemonId: poke.id,
          fromName: poke.name,
          fromFrenchName: poke.frenchName,
          fromSprite: poke.sprite,
          intoSpeciesId: nextEvo.speciesId,
          intoName: nextEvo.speciesName,
          intoFrenchName: evoFrenchName,
          intoSprite: evoSprite,
        };
        dispatch({ type: 'SET_PENDING_EVOLUTION', evolution: pending });
        break; // Handle one evolution at a time
      }
    }, 500);
  }, [state.currentBattle, state.players, dispatch]);

  return (
    <section className="battle-arena">
      <h2>Arene de Combat</h2>
      {eligiblePlayers.length < 2 ? (
        <p className="battle-hint">
          Il faut au moins 2 joueurs avec des Pokemon pour combattre.
        </p>
      ) : (
        <div className="battle-controls">
          <div className="battle-selectors">
            <select
              value={player1Id}
              onChange={e => setPlayer1Id(e.target.value)}
              className="player-select"
            >
              <option value="">Joueur 1...</option>
              {eligiblePlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team.length} Pokemon)
                </option>
              ))}
            </select>

            <span className="vs-badge">VS</span>

            <select
              value={player2Id}
              onChange={e => setPlayer2Id(e.target.value)}
              className="player-select"
            >
              <option value="">Joueur 2...</option>
              {eligiblePlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team.length} Pokemon)
                </option>
              ))}
            </select>
          </div>

          <button className="fight-btn" onClick={handleFight}>
            COMBAT !
          </button>

          {error && <p className="battle-error">{error}</p>}
        </div>
      )}

      {state.currentBattle && (
        <BattleLog
          result={state.currentBattle}
          onClose={() => dispatch({ type: 'CLEAR_BATTLE' })}
          onXpAwarded={handleXpAwarded}
        />
      )}
    </section>
  );
}
