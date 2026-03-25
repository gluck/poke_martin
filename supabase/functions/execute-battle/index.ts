import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeBattle } from '../_shared/battle.ts';
import type { Pokemon, Player } from '../_shared/types.ts';
import { getGrowthRateLevels, getLevelForXp } from '../_shared/growthRates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PokemonRow {
  pokedex_id: number;
  name: string;
  french_name: string;
  sprite: string;
  types: string[];
  base_stats: { hp: number; attack: number; defense: number; spAtk: number; spDef: number; speed: number };
  abilities: string[];
  cry_url: string | null;
  base_experience: number;
  level: number;
  current_xp: number;
  growth_rate_id: string;
  evolution_chain_id: number;
  slot_type: string;
}

function rowToPokemon(row: PokemonRow): Pokemon {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifie');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) throw new Error('Non authentifie');

    const { player1Id, player2Id } = await req.json();
    if (!player1Id || !player2Id) throw new Error('IDs des joueurs requis');

    // Verify ownership
    const { data: players } = await supabase
      .from('players')
      .select('id, name, user_id')
      .in('id', [player1Id, player2Id]);

    if (!players || players.length !== 2) throw new Error('Joueurs introuvables');

    // At least one player must belong to the authenticated user
    const ownsOne = players.some(p => p.user_id === user.id);
    if (!ownsOne) throw new Error('Non autorise');

    // Load teams
    async function loadTeam(playerId: string, playerName: string): Promise<Player> {
      const { data: rows } = await supabase
        .from('pokemon_instances')
        .select('*')
        .eq('player_id', playerId)
        .eq('slot_type', 'team')
        .order('slot_index');

      const team = (rows ?? []).map((r: PokemonRow) => rowToPokemon(r));
      return { id: playerId, name: playerName, team, reserve: [] };
    }

    const p1 = await loadTeam(player1Id, players.find(p => p.id === player1Id)!.name);
    const p2 = await loadTeam(player2Id, players.find(p => p.id === player2Id)!.name);

    if (p1.team.length === 0 || p2.team.length === 0) {
      throw new Error('Les deux joueurs doivent avoir des Pokemon');
    }

    // Execute battle
    const result = await executeBattle(p1, p2);

    // Apply XP gains to DB
    if (result.winner) {
      const winnerId = result.winner.id;
      for (const gain of result.xpGains) {
        const newXp = gain.xp; // gain.xp is the amount to add
        const poke = result.winner.team.find(p => p.id === gain.pokemonId);
        if (!poke) continue;

        const finalXp = poke.currentXp + gain.xp;
        const levels = await getGrowthRateLevels(poke.growthRateId);
        const finalLevel = levels.length > 0 ? Math.min(getLevelForXp(levels, finalXp), 100) : poke.level;

        await supabase
          .from('pokemon_instances')
          .update({ current_xp: finalXp, level: finalLevel })
          .eq('player_id', winnerId)
          .eq('pokedex_id', gain.pokemonId);
      }
    }

    // Save battle history
    await supabase.from('battle_history').insert({
      player1_id: player1Id,
      player2_id: player2Id,
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
