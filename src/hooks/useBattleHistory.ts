import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { BattleResult } from '../types';

export interface BattleHistoryEntry {
  id: string;
  player1Name: string;
  player2Name: string;
  winnerName: string | null;
  createdAt: string;
  battleResult: BattleResult;
}

export function useBattleHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<BattleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id);

    if (!players?.length) {
      setLoading(false);
      return;
    }

    const playerIds = players.map(p => p.id);

    const { data } = await supabase
      .from('battle_history')
      .select('*')
      .or(playerIds.map(id => `player1_id.eq.${id},player2_id.eq.${id}`).join(','))
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      const entries: BattleHistoryEntry[] = data.map((row: any) => {
        const p1Name = row.player1_snapshot?.name ?? '?';
        const p2Name = row.player2_snapshot?.name ?? '?';
        let winnerName: string | null = null;
        if (row.winner_player_id === row.player1_id) winnerName = p1Name;
        else if (row.winner_player_id === row.player2_id) winnerName = p2Name;

        const battleResult: BattleResult = {
          player1: { id: row.player1_id, name: p1Name, team: row.player1_snapshot?.team ?? [], reserve: [] },
          player2: { id: row.player2_id, name: p2Name, team: row.player2_snapshot?.team ?? [], reserve: [] },
          rounds: row.rounds ?? [],
          winner: row.winner_player_id
            ? {
                id: row.winner_player_id,
                name: row.winner_player_id === row.player1_id ? p1Name : p2Name,
                team: [],
                reserve: [],
              }
            : null,
          xpGains: row.xp_gains ?? [],
        };

        return { id: row.id, player1Name: p1Name, player2Name: p2Name, winnerName, createdAt: row.created_at, battleResult };
      });
      setHistory(entries);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return { history, loading, reload: loadHistory };
}
