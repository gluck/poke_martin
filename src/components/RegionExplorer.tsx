import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../lib/supabase';
import { PokemonCard } from './PokemonCard';
import { BattleLog } from './BattleLog';
import { ConfirmModal } from './ConfirmModal';
import { REGIONS } from '../data/regions';
import type { Pokemon, BattleResult } from '../types';
import './RegionExplorer.css';

export function RegionExplorer() {
  const { state, dispatch } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [wildPokemon, setWildPokemon] = useState<Pokemon | null>(null);
  const [explorationId, setExplorationId] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [captureResult, setCaptureResult] = useState<{ success: boolean; message: string } | null>(null);
  const [charmCooldown, setCharmCooldown] = useState(false);

  const eligiblePlayers = state.players.filter(p => p.team.length > 0);

  const loadRemaining = useCallback(async (playerId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('exploration_log')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', playerId)
        .eq('explored_at', today);
      setRemaining(5 - (count ?? 0));
    } catch {
      setRemaining(null);
    }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      loadRemaining(selectedPlayerId);
    } else {
      setRemaining(null);
    }
  }, [selectedPlayerId, loadRemaining]);

  const handleExplore = async (pokedexId: number) => {
    if (!selectedPlayerId) {
      setError('Choisis un joueur d\'abord');
      return;
    }
    setError('');
    setWildPokemon(null);
    setBattleResult(null);
    setCaptureResult(null);
    setLoading(true);

    try {
      const res = await supabase.functions.invoke('explore-region', {
        body: { playerId: selectedPlayerId, regionPokedexId: pokedexId },
      });
      const data = res.data;
      if (res.error || data?.error) {
        const msg = data?.error || res.error?.message || 'Erreur';
        setError(msg);
        // Reload remaining in case the error is about the limit
        await loadRemaining(selectedPlayerId);
        return;
      }

      setWildPokemon(data.pokemon);
      setExplorationId(data.explorationId);
      setRemaining(data.remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleCombat = async (fighterPokemonId: number) => {
    if (!explorationId) return;
    setLoading(true);
    setError('');

    try {
      const res = await supabase.functions.invoke('capture-pokemon', {
        body: { playerId: selectedPlayerId, explorationId, method: 'combat', fighterPokemonId },
      });
      const data = res.data;
      if (res.error || data?.error) {
        setError(data?.error || res.error?.message || 'Erreur lors du combat');
        return;
      }

      if (data.battleResult) {
        setBattleResult({ ...data.battleResult, xpGains: [] });
      }
      if (data.captured && data.pokemon) {
        dispatch({ type: 'ADD_POKEMON', playerId: selectedPlayerId, pokemon: data.pokemon });
        setCaptureResult({ success: true, message: `${data.pokemon.frenchName || data.pokemon.name} capture !` });
      } else if (!data.captured) {
        setCaptureResult({ success: false, message: 'Perdu... Le Pokemon s\'est enfui !' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleCharm = async () => {
    if (!explorationId || charmCooldown) return;
    setLoading(true);
    setError('');

    try {
      const res = await supabase.functions.invoke('capture-pokemon', {
        body: { playerId: selectedPlayerId, explorationId, method: 'charm' },
      });
      const data = res.data;
      if (res.error || data?.error) {
        setError(data?.error || res.error?.message || 'Erreur');
        return;
      }

      if (data.captured && data.pokemon) {
        dispatch({ type: 'ADD_POKEMON', playerId: selectedPlayerId, pokemon: data.pokemon });
        setCaptureResult({ success: true, message: `${data.pokemon.frenchName || data.pokemon.name} amadoue !` });
      } else {
        setCaptureResult({ success: false, message: 'Ca n\'a pas marche... Reessaie dans 30s !' });
        setCharmCooldown(true);
        setTimeout(() => setCharmCooldown(false), 30000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const player = state.players.find(p => p.id === selectedPlayerId);

  return (
    <section className="region-explorer">
      <h2>Explorer une region</h2>

      <div className="explorer-player-select">
        <label>Joueur explorateur :</label>
        <select value={selectedPlayerId} onChange={e => { setSelectedPlayerId(e.target.value); setWildPokemon(null); setCaptureResult(null); }}>
          <option value="">Choisir un joueur...</option>
          {eligiblePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.team.length} Pokemon)</option>
          ))}
        </select>
        {remaining !== null && <span className="explorations-remaining">{remaining}/5 explorations restantes</span>}
      </div>

      {selectedPlayerId && !wildPokemon && !captureResult && (
        <div className="region-grid">
          {REGIONS.map(region => (
            <button
              key={region.name}
              className="region-card"
              onClick={() => handleExplore(region.pokedexId)}
              disabled={loading || remaining === 0}
            >
              <img src={region.image} alt={region.name} className="region-card-img" />
              <span className="region-card-name" style={{ backgroundColor: region.color }}>
                {region.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="explorer-error">{error}</p>}

      {wildPokemon && !captureResult && (
        <div className="wild-encounter">
          <h3>Un Pokemon sauvage apparait !</h3>
          <PokemonCard pokemon={wildPokemon} />
          <div className="encounter-actions">
            <div className="combat-action">
              <label>Combattre avec :</label>
              <div className="fighter-options">
                {player?.team.map(poke => (
                  <button
                    key={poke.id}
                    className="fighter-btn"
                    onClick={() => handleCombat(poke.id)}
                    disabled={loading}
                    title={`${poke.frenchName || poke.name} Nv.${poke.level}`}
                  >
                    <img src={poke.sprite} alt={poke.frenchName || poke.name} />
                    <span>Nv.{poke.level}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              className="charm-btn"
              onClick={handleCharm}
              disabled={loading || charmCooldown}
            >
              {charmCooldown ? 'Cooldown...' : 'Amadouer'}
            </button>
          </div>
        </div>
      )}

      {captureResult && (
        <ConfirmModal
          message={captureResult.message}
          confirmLabel="OK"
          cancelLabel="Fermer"
          onConfirm={() => { setCaptureResult(null); setWildPokemon(null); }}
          onCancel={() => { setCaptureResult(null); setWildPokemon(null); }}
        />
      )}

      {battleResult && (
        <BattleLog
          result={battleResult}
          onClose={() => setBattleResult(null)}
        />
      )}
    </section>
  );
}
