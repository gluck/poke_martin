import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { executeBattle } from '../utils/battle';
import { BattleLog } from './BattleLog';
import { PokemonCard } from './PokemonCard';
import { transformApiPokemon } from '../api/pokeapi';
import { searchPokemonByPartial } from '../api/pokeapi';
import type { Player, Pokemon, PokeAPIPokemon } from '../types';
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

  // Duel 1v1
  const [duelSearch1, setDuelSearch1] = useState('');
  const [duelSearch2, setDuelSearch2] = useState('');
  const [duelResults1, setDuelResults1] = useState<Pokemon[]>([]);
  const [duelResults2, setDuelResults2] = useState<Pokemon[]>([]);
  const [duelPoke1, setDuelPoke1] = useState<Pokemon | null>(null);
  const [duelPoke2, setDuelPoke2] = useState<Pokemon | null>(null);
  const [duelLevel, setDuelLevel] = useState(50);
  const [duelLoading, setDuelLoading] = useState(false);

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

  // Duel search
  const handleDuelSearch = async (side: 1 | 2) => {
    const query = side === 1 ? duelSearch1 : duelSearch2;
    if (!query.trim()) return;
    setDuelLoading(true);
    try {
      const results = await searchPokemonByPartial(query);
      if (side === 1) setDuelResults1(results);
      else setDuelResults2(results);
    } catch { /* ignore */ }
    finally { setDuelLoading(false); }
  };

  const handleDuelSelectEvo = async (side: 1 | 2, speciesId: number) => {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
      if (!res.ok) return;
      const raw: PokeAPIPokemon = await res.json();
      const poke = await transformApiPokemon(raw);
      if (side === 1) setDuelPoke1(poke);
      else setDuelPoke2(poke);
    } catch { /* ignore */ }
  };

  const handleDuel = () => {
    if (!duelPoke1 || !duelPoke2) {
      setError('Choisis un Pokemon de chaque cote');
      return;
    }
    setError('');
    const p1 = { ...duelPoke1, level: duelLevel };
    const p2 = { ...duelPoke2, level: duelLevel };
    const result = executeBattle(
      { id: 'duel-1', name: p1.frenchName || p1.name, team: [p1], reserve: [] },
      { id: 'duel-2', name: p2.frenchName || p2.name, team: [p2], reserve: [] },
    );
    dispatch({ type: 'SET_BATTLE_RESULT', result: { ...result, xpGains: [] } });
  };

  const renderDuelSide = (side: 1 | 2) => {
    const search = side === 1 ? duelSearch1 : duelSearch2;
    const setSearch = side === 1 ? setDuelSearch1 : setDuelSearch2;
    const results = side === 1 ? duelResults1 : duelResults2;
    const selected = side === 1 ? duelPoke1 : duelPoke2;
    const setSelected = side === 1 ? setDuelPoke1 : setDuelPoke2;

    return (
      <div className="duel-side">
        <form className="duel-search-form" onSubmit={e => { e.preventDefault(); handleDuelSearch(side); }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher..."
            className="duel-search-input"
          />
          <button type="submit" className="duel-search-btn" disabled={duelLoading}>Chercher</button>
        </form>
        {!selected && results.length > 0 && (
          <div className="duel-results">
            {results.map(p => (
              <button key={p.id} className="duel-pick" onClick={() => setSelected(p)} title={p.frenchName || p.name}>
                <img src={p.sprite} alt={p.frenchName || p.name} />
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="duel-selected">
            <PokemonCard
              pokemon={selected}
              hideLevel
              onEvolve={(speciesId) => handleDuelSelectEvo(side, speciesId)}
            />
            <button className="duel-clear" onClick={() => setSelected(null)}>Changer</button>
          </div>
        )}
      </div>
    );
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

      {/* Duel 1v1 */}
      <div className="duel-section">
        <h3>Duel 1v1</h3>
        <div className="duel-sides">
          {renderDuelSide(1)}
          <span className="vs-badge">VS</span>
          {renderDuelSide(2)}
        </div>
        <div className="duel-level">
          <label>Niveau : {duelLevel}</label>
          <input
            type="range"
            min={1}
            max={100}
            value={duelLevel}
            onChange={e => setDuelLevel(Number(e.target.value))}
            className="duel-slider"
          />
        </div>
        <button
          className="fight-btn duel-btn"
          onClick={handleDuel}
          disabled={!duelPoke1 || !duelPoke2}
        >
          DUEL !
        </button>
      </div>

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
