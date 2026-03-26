import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeBattle } from '../_shared/battle.ts';
import type { Pokemon, Player } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PokemonRow {
  pokedex_id: number; name: string; french_name: string; sprite: string;
  types: string[]; base_stats: any; abilities: string[]; cry_url: string | null;
  base_experience: number; level: number; current_xp: number;
  growth_rate_id: string; evolution_chain_id: number;
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

    const { playerId, explorationId, method, fighterPokemonId } = await req.json();
    if (!playerId || !explorationId || !method) throw new Error('Parametres manquants');

    // Verify ownership
    const { data: player } = await supabase.from('players').select('id, name, user_id').eq('id', playerId).single();
    if (!player || player.user_id !== user.id) throw new Error('Non autorise');

    // Load exploration
    const { data: exploration } = await supabase
      .from('exploration_log')
      .select('*')
      .eq('id', explorationId)
      .eq('player_id', playerId)
      .single();
    if (!exploration) throw new Error('Exploration introuvable');
    if (exploration.captured) throw new Error('Pokemon deja capture');

    const wildPokemon: Pokemon = exploration.pokemon_data;

    if (method === 'combat') {
      if (!fighterPokemonId) throw new Error('Pokemon combattant requis');

      // Load fighter
      const fighterId = Number(fighterPokemonId);
      const { data: fighterRows } = await supabase
        .from('pokemon_instances')
        .select('*')
        .eq('player_id', playerId)
        .eq('pokedex_id', fighterId)
        .limit(1);
      const fighterRow = fighterRows?.[0];
      if (!fighterRow) throw new Error('Pokemon combattant introuvable');

      const fighter = rowToPokemon(fighterRow as PokemonRow);

      // Build 1v1 battle
      const myPlayer: Player = { id: playerId, name: player.name, team: [fighter], reserve: [] };
      const wildPlayer: Player = { id: 'wild', name: 'Pokemon Sauvage', team: [wildPokemon], reserve: [] };

      const result = await executeBattle(myPlayer, wildPlayer);
      const won = result.winner?.id === playerId;

      if (won) {
        // Insert captured Pokemon
        const { count } = await supabase
          .from('pokemon_instances')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('slot_type', 'team');
        const teamCount = count ?? 0;
        const slotType = teamCount < 6 ? 'team' : 'reserve';

        await supabase.from('pokemon_instances').insert({
          player_id: playerId,
          pokedex_id: wildPokemon.id,
          name: wildPokemon.name,
          french_name: wildPokemon.frenchName,
          sprite: wildPokemon.sprite,
          types: wildPokemon.types,
          base_stats: wildPokemon.stats,
          abilities: wildPokemon.abilities,
          cry_url: wildPokemon.cryUrl,
          base_experience: wildPokemon.baseExperience,
          level: wildPokemon.level,
          current_xp: 0,
          growth_rate_id: wildPokemon.growthRateId,
          evolution_chain_id: wildPokemon.evolutionChainId,
          slot_type: slotType,
          slot_index: slotType === 'team' ? teamCount : 0,
        });

        await supabase.from('exploration_log').update({ captured: true }).eq('id', explorationId);
      }

      return new Response(JSON.stringify({
        captured: won,
        battleResult: result,
        pokemon: won ? wildPokemon : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (method === 'charm') {
      // Load player's best pokemon level for charm calculation
      const { data: teamPokemon } = await supabase
        .from('pokemon_instances')
        .select('level')
        .eq('player_id', playerId)
        .eq('slot_type', 'team')
        .order('level', { ascending: false })
        .limit(1);

      const bestLevel = teamPokemon?.[0]?.level ?? 5;
      const chance = Math.min(80, 30 + (bestLevel - wildPokemon.level) * 5);
      const roll = Math.random() * 100;
      const success = roll < chance;

      if (success) {
        const { count } = await supabase
          .from('pokemon_instances')
          .select('*', { count: 'exact', head: true })
          .eq('player_id', playerId)
          .eq('slot_type', 'team');
        const teamCount = count ?? 0;
        const slotType = teamCount < 6 ? 'team' : 'reserve';

        await supabase.from('pokemon_instances').insert({
          player_id: playerId,
          pokedex_id: wildPokemon.id,
          name: wildPokemon.name,
          french_name: wildPokemon.frenchName,
          sprite: wildPokemon.sprite,
          types: wildPokemon.types,
          base_stats: wildPokemon.stats,
          abilities: wildPokemon.abilities,
          cry_url: wildPokemon.cryUrl,
          base_experience: wildPokemon.baseExperience,
          level: wildPokemon.level,
          current_xp: 0,
          growth_rate_id: wildPokemon.growthRateId,
          evolution_chain_id: wildPokemon.evolutionChainId,
          slot_type: slotType,
          slot_index: slotType === 'team' ? teamCount : 0,
        });

        await supabase.from('exploration_log').update({ captured: true }).eq('id', explorationId);
      }

      return new Response(JSON.stringify({
        captured: success,
        chance: Math.round(chance),
        pokemon: success ? wildPokemon : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Methode invalide');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
