import { useState } from 'react';
import { useRealtimeChallenges } from '../hooks/useRealtimeChallenges';
import { useGame } from '../context/GameContext';
import { supabase } from '../lib/supabase';
import { BattleLog } from './BattleLog';
import type { BattleResult } from '../types';
import './ChallengeNotification.css';

export function ChallengeNotification() {
  const { pendingChallenges, reload } = useRealtimeChallenges();
  const { state } = useGame();
  const [loading, setLoading] = useState<string | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Record<string, string>>({});

  const myPlayers = state.players.filter(p => p.team.length > 0);

  const handleAccept = async (challengeId: string) => {
    const playerId = selectedPlayer[challengeId];
    if (!playerId) return;

    setLoading(challengeId);
    try {
      const res = await supabase.functions.invoke('handle-challenge', {
        body: { challengeId, action: 'accept', opponentPlayerId: playerId },
      });
      if (res.error) throw new Error(res.error.message);
      setBattleResult(res.data as BattleResult);
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async (challengeId: string) => {
    setLoading(challengeId);
    try {
      await supabase.functions.invoke('handle-challenge', {
        body: { challengeId, action: 'decline' },
      });
      await reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  if (pendingChallenges.length === 0 && !battleResult) return null;

  return (
    <>
      <div className="challenge-notifications">
        {pendingChallenges.map(c => {
          const timeLeft = Math.max(0, Math.floor((new Date(c.expiresAt).getTime() - Date.now()) / 1000));
          return (
            <div key={c.id} className="challenge-toast">
              <div className="challenge-icon">&#x2694;</div>
              <div className="challenge-info">
                <strong>{c.challengerName}</strong> te defie avec <strong>{c.challengerPlayerName}</strong> !
                <span className="challenge-timer">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="challenge-actions">
                <select
                  value={selectedPlayer[c.id] ?? ''}
                  onChange={e => setSelectedPlayer(s => ({ ...s, [c.id]: e.target.value }))}
                  className="challenge-player-select"
                >
                  <option value="">Ton joueur...</option>
                  {myPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  className="challenge-accept"
                  onClick={() => handleAccept(c.id)}
                  disabled={loading === c.id || !selectedPlayer[c.id]}
                >
                  {loading === c.id ? '...' : 'Accepter'}
                </button>
                <button
                  className="challenge-decline"
                  onClick={() => handleDecline(c.id)}
                  disabled={loading === c.id}
                >
                  Refuser
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {battleResult && (
        <BattleLog
          result={battleResult}
          onClose={() => setBattleResult(null)}
        />
      )}
    </>
  );
}
