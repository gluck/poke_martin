import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeBattle } from '../_shared/battle.ts';
import type { Pokemon, Player } from '../_shared/types.ts';
import { getGrowthRateLevels, getLevelForXp } from '../_shared/growthRates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PokemonRow {
  pokedex_id: number; name: string; french_name: string; sprite: string;
  types: string[]; base_stats: any; abilities: string[]; cry_url: string | null;
  base_experience: number; level: number; current_xp: number;
  growth_rate_id: string; evolution_chain_id: number; slot_type: string;
}

function rowToPokemon(row: PokemonRow): Pokemon {
  return {
    id: row.pokedex_id, name: row.name, frenchName: row.french_name,
    sprite: row.sprite, types: row.types, stats: row.base_stats,
    abilities: row.abilities, cryUrl: row.cry_url,
    baseExperience: row.base_experience, level: row.level,
    currentXp: row.current_xp, growthRateId: row.growth_rate_id,
    evolutionChainId: row.evolution_chain_id,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifie');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Non authentifie');

    const { challengeId, action, opponentPlayerId } = await req.json();
    if (!challengeId || !action) throw new Error('Parametres manquants');

    // Load challenge
    const { data: challenge } = await supabase
      .from('battle_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (!challenge) throw new Error('Defi introuvable');
    if (challenge.opponent_id !== user.id) throw new Error('Non autorise');
    if (challenge.status !== 'pending') throw new Error('Defi deja traite');

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      await supabase.from('battle_challenges').update({ status: 'expired' }).eq('id', challengeId);
      throw new Error('Defi expire');
    }

    if (action === 'decline') {
      await supabase.from('battle_challenges').update({ status: 'declined' }).eq('id', challengeId);
      return new Response(JSON.stringify({ status: 'declined' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'accept') throw new Error('Action invalide');
    if (!opponentPlayerId) throw new Error('Joueur adverse requis');

    // Update challenge
    await supabase.from('battle_challenges').update({
      status: 'accepted',
      opponent_player_id: opponentPlayerId,
    }).eq('id', challengeId);

    // Load teams
    async function loadTeam(playerId: string): Promise<{ name: string; team: Pokemon[] }> {
      const { data: player } = await supabase.from('players').select('name').eq('id', playerId).single();
      const { data: rows } = await supabase.from('pokemon_instances').select('*')
        .eq('player_id', playerId).eq('slot_type', 'team').order('slot_index');
      return { name: player?.name ?? '?', team: (rows ?? []).map((r: PokemonRow) => rowToPokemon(r)) };
    }

    const p1Data = await loadTeam(challenge.challenger_player_id);
    const p2Data = await loadTeam(opponentPlayerId);

    const p1: Player = { id: challenge.challenger_player_id, name: p1Data.name, team: p1Data.team, reserve: [] };
    const p2: Player = { id: opponentPlayerId, name: p2Data.name, team: p2Data.team, reserve: [] };

    if (p1.team.length === 0 || p2.team.length === 0) {
      throw new Error('Les deux joueurs doivent avoir des Pokemon');
    }

    const result = await executeBattle(p1, p2);

    // Apply XP
    if (result.winner) {
      for (const gain of result.xpGains) {
        const poke = result.winner.team.find(p => p.id === gain.pokemonId);
        if (!poke) continue;
        const finalXp = poke.currentXp + gain.xp;
        const levels = await getGrowthRateLevels(poke.growthRateId);
        const finalLevel = levels.length > 0 ? Math.min(getLevelForXp(levels, finalXp), 100) : poke.level;
        await supabase.from('pokemon_instances')
          .update({ current_xp: finalXp, level: finalLevel })
          .eq('player_id', result.winner.id)
          .eq('pokedex_id', gain.pokemonId);
      }
    }

    // Save history
    await supabase.from('battle_history').insert({
      player1_id: challenge.challenger_player_id,
      player2_id: opponentPlayerId,
      winner_player_id: result.winner?.id ?? null,
      rounds: result.rounds,
      xp_gains: result.xpGains,
      player1_snapshot: { name: p1.name, team: p1.team },
      player2_snapshot: { name: p2.name, team: p2.team },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
