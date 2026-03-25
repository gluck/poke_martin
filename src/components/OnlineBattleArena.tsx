import { useState, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../hooks/useFriends';
import { supabase } from '../lib/supabase';
import { BattleLog } from './BattleLog';
import type { BattleResult } from '../types';
import './OnlineBattleArena.css';

export function OnlineBattleArena() {
  const { state, dispatch } = useGame();
  const { user } = useAuth();
  const { friends } = useFriends();
  const [selectedFriend, setSelectedFriend] = useState('');
  const [selectedMyPlayer, setSelectedMyPlayer] = useState('');
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const myPlayers = state.players.filter(p => p.team.length > 0);

  const handleSendChallenge = async () => {
    if (!selectedMyPlayer || !selectedFriend) {
      setError('Choisis ton joueur et un ami');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error: insertError } = await supabase.from('battle_challenges').insert({
        challenger_id: user!.id,
        challenger_player_id: selectedMyPlayer,
        opponent_id: selectedFriend,
      });
      if (insertError) throw new Error(insertError.message);

      const friendName = friends.find(f => f.friend.id === selectedFriend)?.friend.displayName ?? 'ton ami';
      setSuccess(`Defi envoye a ${friendName} ! En attente de reponse...`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  // Listen for challenge result (when opponent accepts our challenge)
  const checkChallengeResult = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('battle_challenges')
      .select('id, status')
      .eq('challenger_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data?.length) {
      // The battle was already executed server-side, fetch from history
      const { data: history } = await supabase
        .from('battle_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (history?.length) {
        const h = history[0];
        // Reconstruct minimal BattleResult for display
        const result: BattleResult = {
          player1: { id: h.player1_id, name: h.player1_snapshot?.name ?? '?', team: h.player1_snapshot?.team ?? [], reserve: [] },
          player2: { id: h.player2_id, name: h.player2_snapshot?.name ?? '?', team: h.player2_snapshot?.team ?? [], reserve: [] },
          rounds: h.rounds ?? [],
          winner: h.winner_player_id
            ? { id: h.winner_player_id, name: (h.winner_player_id === h.player1_id ? h.player1_snapshot?.name : h.player2_snapshot?.name) ?? '?', team: [], reserve: [] }
            : null,
          xpGains: h.xp_gains ?? [],
        };
        setBattleResult(result);
        setSuccess('');

        // Reload state to get updated XP
        await reloadState();
      }
    }
  }, [user]);

  const reloadState = async () => {
    if (!user) return;
    const { data: playerRows } = await supabase
      .from('players')
      .select('id, name')
      .eq('user_id', user.id);
    if (playerRows) {
      const players = await Promise.all(playerRows.map(async (pr) => {
        const { data: pokemonRows } = await supabase
          .from('pokemon_instances')
          .select('*')
          .eq('player_id', pr.id)
          .order('slot_index');
        const team = (pokemonRows ?? []).filter((r: any) => r.slot_type === 'team').map(rowToPokemon);
        const reserve = (pokemonRows ?? []).filter((r: any) => r.slot_type === 'reserve').map(rowToPokemon);
        return { id: pr.id, name: pr.name, team, reserve };
      }));
      dispatch({ type: 'LOAD_STATE', players });
    }
  };

  // Realtime: listen for our challenges getting accepted
  // (check periodically since the battle_challenges filter is on opponent_id)
  // Simple approach: poll when success message is shown
  if (success) {
    setTimeout(() => checkChallengeResult(), 5000);
  }

  if (friends.length === 0) return null;

  return (
    <section className="online-battle">
      <h2>Defier un ami</h2>
      <div className="online-battle-controls">
        <div className="online-battle-side">
          <label>Ton joueur</label>
          <select value={selectedMyPlayer} onChange={e => setSelectedMyPlayer(e.target.value)}>
            <option value="">Choisir...</option>
            {myPlayers.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.team.length} Pokemon)</option>
            ))}
          </select>
        </div>

        <span className="online-vs">VS</span>

        <div className="online-battle-side">
          <label>Ami</label>
          <select value={selectedFriend} onChange={e => { setSelectedFriend(e.target.value); setSuccess(''); setError(''); }}>
            <option value="">Choisir un ami...</option>
            {friends.map(f => (
              <option key={f.friend.id} value={f.friend.id}>{f.friend.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="online-fight-btn"
        onClick={handleSendChallenge}
        disabled={loading || !selectedMyPlayer || !selectedFriend}
      >
        {loading ? 'Envoi...' : 'ENVOYER LE DEFI !'}
      </button>

      {error && <p className="online-error">{error}</p>}
      {success && <p className="online-success">{success}</p>}

      {battleResult && (
        <BattleLog
          result={battleResult}
          onClose={() => setBattleResult(null)}
        />
      )}
    </section>
  );
}

function rowToPokemon(row: any) {
  return {
    id: row.pokedex_id,
    name: row.name,
    frenchName: row.french_name,
    sprite: row.sprite,
    types: row.types,
    stats: row.base_stats,
    abilities: row.abilities,
    cryUrl: row.cry_url,
    baseExperience: row.base_experience,
    level: row.level,
    currentXp: row.current_xp,
    growthRateId: row.growth_rate_id,
    evolutionChainId: row.evolution_chain_id,
  };
}
