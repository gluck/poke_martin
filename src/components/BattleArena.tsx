import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { executeBattle } from '../utils/battle';
import { BattleLog } from './BattleLog';
import { transformApiPokemon } from '../api/pokeapi';
import type { Player, PokeAPIPokemon } from '../types';
import './BattleArena.css';

async function generateRandomTeam(teamSize: number, levels: number[]): Promise<Player> {
  const pokemonIds = new Set<number>();
  while (pokemonIds.size < teamSize) {
    pokemonIds.add(Math.floor(Math.random() * 898) + 1);
  }

  const team = await Promise.all(
    Array.from(pokemonIds).map(async (id, i) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!res.ok) return null;
        const raw: PokeAPIPokemon = await res.json();
        const poke = await transformApiPokemon(raw);
        poke.level = levels[i] ?? levels[0] ?? 5;
        return poke;
      } catch {
        return null;
      }
    })
  );

  const validTeam = team.filter(p => p !== null);
  return {
    id: 'random-' + Date.now(),
    name: 'Dresseur Sauvage',
    team: validTeam,
    reserve: [],
  };
}

export function BattleArena() {
  const { state, dispatch } = useGame();
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [error, setError] = useState('');
  const [randomPlayerId, setRandomPlayerId] = useState('');
  const [loadingRandom, setLoadingRandom] = useState(false);

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
    dispatch({ type: 'SET_BATTLE_RESULT', result: { ...result, xpGains: [] } });
  };

  const handleRandomFight = async () => {
    if (!randomPlayerId) {
      setError('Choisis ton joueur');
      return;
    }
    setError('');
    setLoadingRandom(true);

    const player = state.players.find(p => p.id === randomPlayerId);
    if (!player || player.team.length === 0) {
      setError('Ce joueur n\'a pas de Pokemon');
      setLoadingRandom(false);
      return;
    }

    try {
      const levels = player.team.map(p => p.level);
      const opponent = await generateRandomTeam(player.team.length, levels);
      if (opponent.team.length === 0) {
        setError('Erreur lors de la generation de l\'adversaire');
        setLoadingRandom(false);
        return;
      }
      const result = executeBattle(player, opponent);
      dispatch({ type: 'SET_BATTLE_RESULT', result: { ...result, xpGains: [] } });
    } catch {
      setError('Erreur lors du combat');
    } finally {
      setLoadingRandom(false);
    }
  };

  return (
    <section className="battle-arena">
      <h2>Arene de Combat</h2>

      {/* Combat entre joueurs */}
      {eligiblePlayers.length >= 2 && (
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
        </div>
      )}

      {/* Combat aleatoire */}
      {eligiblePlayers.length >= 1 && (
        <div className="random-battle">
          <div className="random-battle-row">
            <select
              value={randomPlayerId}
              onChange={e => setRandomPlayerId(e.target.value)}
              className="player-select"
            >
              <option value="">Ton joueur...</option>
              {eligiblePlayers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team.length} Pokemon)
                </option>
              ))}
            </select>

            <span className="vs-badge">VS</span>
            <span className="random-opponent">? Dresseur Sauvage ?</span>
          </div>

          <button
            className="fight-btn random-fight-btn"
            onClick={handleRandomFight}
            disabled={loadingRandom}
          >
            {loadingRandom ? 'Generation...' : 'COMBAT ALEATOIRE !'}
          </button>
        </div>
      )}

      {error && <p className="battle-error">{error}</p>}

      {state.currentBattle && (
        <BattleLog
          result={state.currentBattle}
          onClose={() => dispatch({ type: 'CLEAR_BATTLE' })}
        />
      )}
    </section>
  );
}
