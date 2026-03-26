import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_EXPLORATIONS_PER_DAY = 5;

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

    const { playerId, regionPokedexId } = await req.json();
    if (!playerId || !regionPokedexId) throw new Error('Parametres manquants');

    // Verify ownership
    const { data: player } = await supabase
      .from('players')
      .select('id, user_id')
      .eq('id', playerId)
      .single();
    if (!player || player.user_id !== user.id) throw new Error('Non autorise');

    // Count today's explorations
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('exploration_log')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('explored_at', today);

    const used = count ?? 0;
    if (used >= MAX_EXPLORATIONS_PER_DAY) {
      throw new Error(`Limite atteinte ! ${MAX_EXPLORATIONS_PER_DAY}/${MAX_EXPLORATIONS_PER_DAY} explorations utilisees aujourd'hui.`);
    }

    // Get average level of player's team
    const { data: teamPokemon } = await supabase
      .from('pokemon_instances')
      .select('level')
      .eq('player_id', playerId)
      .eq('slot_type', 'team');

    const avgLevel = teamPokemon && teamPokemon.length > 0
      ? Math.round(teamPokemon.reduce((s, p) => s + p.level, 0) / teamPokemon.length)
      : 5;

    // Fetch regional pokedex
    const pokedexRes = await fetch(`https://pokeapi.co/api/v2/pokedex/${regionPokedexId}`);
    if (!pokedexRes.ok) throw new Error('Region introuvable');
    const pokedexData = await pokedexRes.json();
    const entries = pokedexData.pokemon_entries;
    if (!entries?.length) throw new Error('Pokedex vide');

    // Pick random Pokemon
    const entry = entries[Math.floor(Math.random() * entries.length)];
    const speciesUrl = entry.pokemon_species.url;
    const speciesId = parseInt(speciesUrl.split('/').filter(Boolean).pop()!, 10);

    // Fetch Pokemon data
    const pokemonRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
    if (!pokemonRes.ok) throw new Error('Pokemon introuvable');
    const pokemonRaw = await pokemonRes.json();

    // Fetch species for French name
    const speciesRes = await fetch(pokemonRaw.species.url);
    const speciesData = speciesRes.ok ? await speciesRes.json() : null;
    const frenchNameEntry = speciesData?.names?.find((n: any) => n.language.name === 'fr');
    const frenchName = frenchNameEntry?.name ?? pokemonRaw.name;

    // Build Pokemon object
    const wildLevel = Math.max(2, avgLevel + Math.floor(Math.random() * 7) - 3);
    const stats = {
      hp: pokemonRaw.stats.find((s: any) => s.stat.name === 'hp')?.base_stat ?? 40,
      attack: pokemonRaw.stats.find((s: any) => s.stat.name === 'attack')?.base_stat ?? 40,
      defense: pokemonRaw.stats.find((s: any) => s.stat.name === 'defense')?.base_stat ?? 40,
      spAtk: pokemonRaw.stats.find((s: any) => s.stat.name === 'special-attack')?.base_stat ?? 40,
      spDef: pokemonRaw.stats.find((s: any) => s.stat.name === 'special-defense')?.base_stat ?? 40,
      speed: pokemonRaw.stats.find((s: any) => s.stat.name === 'speed')?.base_stat ?? 40,
    };

    const pokemon = {
      id: pokemonRaw.id,
      name: pokemonRaw.name,
      frenchName,
      sprite: pokemonRaw.sprites?.other?.['official-artwork']?.front_default ?? pokemonRaw.sprites?.front_default ?? '',
      types: pokemonRaw.types.map((t: any) => t.type.name),
      stats,
      abilities: pokemonRaw.abilities.map((a: any) => a.ability.name),
      cryUrl: pokemonRaw.cries?.latest ?? null,
      baseExperience: pokemonRaw.base_experience ?? 50,
      level: wildLevel,
      currentXp: 0,
      growthRateId: speciesData?.growth_rate?.name ?? 'medium',
      evolutionChainId: 0,
    };

    // Log exploration
    const { data: logEntry } = await supabase
      .from('exploration_log')
      .insert({ player_id: playerId, pokemon_id: speciesId, pokemon_data: pokemon })
      .select('id')
      .single();

    return new Response(JSON.stringify({
      pokemon,
      explorationId: logEntry?.id,
      remaining: MAX_EXPLORATIONS_PER_DAY - used - 1,
    }), {
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
