import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Challenge {
  id: string;
  challengerName: string;
  challengerPlayerId: string;
  challengerPlayerName: string;
  expiresAt: string;
}

export function useRealtimeChallenges() {
  const { user } = useAuth();
  const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);

  const loadPending = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('battle_challenges')
      .select(`
        id, expires_at, challenger_player_id,
        challenger:profiles!challenger_id(display_name),
        challenger_player:players!challenger_player_id(name)
      `)
      .eq('opponent_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (data) {
      setPendingChallenges(data.map((row: any) => ({
        id: row.id,
        challengerName: row.challenger?.display_name ?? '?',
        challengerPlayerId: row.challenger_player_id,
        challengerPlayerName: row.challenger_player?.name ?? '?',
        expiresAt: row.expires_at,
      })));
    }
  }, [user]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('challenges-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'battle_challenges',
          filter: `opponent_id=eq.${user.id}`,
        },
        () => { loadPending(); }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_challenges',
          filter: `opponent_id=eq.${user.id}`,
        },
        () => { loadPending(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadPending]);

  // Expire check every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingChallenges(prev =>
        prev.filter(c => new Date(c.expiresAt) > new Date())
      );
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return { pendingChallenges, reload: loadPending };
}
