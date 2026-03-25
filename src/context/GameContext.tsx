import { createContext, useContext, useReducer, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import type { GameState, GameAction, Player, Pokemon } from '../types';
import { getGrowthRate, getLevelForXp, getXpForLevel, getAllChainSpeciesIds } from '../api/evolution';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'poke_martin_state';

// ---- DB helpers ----

function pokemonToRow(pokemon: Pokemon, playerId: string, slotType: 'team' | 'reserve', slotIndex: number) {
  return {
    player_id: playerId,
    pokedex_id: pokemon.id,
    name: pokemon.name,
    french_name: pokemon.frenchName,
    sprite: pokemon.sprite,
    types: pokemon.types,
    base_stats: pokemon.stats,
    abilities: pokemon.abilities,
    cry_url: pokemon.cryUrl,
    base_experience: pokemon.baseExperience,
    level: pokemon.level,
    current_xp: pokemon.currentXp,
    growth_rate_id: pokemon.growthRateId,
    evolution_chain_id: pokemon.evolutionChainId,
    slot_type: slotType,
    slot_index: slotIndex,
  };
}

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
  slot_index: number;
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

async function loadFromSupabase(userId: string): Promise<Player[]> {
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, name')
    .eq('user_id', userId);

  if (!playerRows?.length) return [];

  const players: Player[] = [];
  for (const pr of playerRows) {
    const { data: pokemonRows } = await supabase
      .from('pokemon_instances')
      .select('*')
      .eq('player_id', pr.id)
      .order('slot_index');

    const team: Pokemon[] = [];
    const reserve: Pokemon[] = [];
    for (const row of (pokemonRows ?? []) as PokemonRow[]) {
      const poke = rowToPokemon(row);
      if (row.slot_type === 'team') team.push(poke);
      else reserve.push(poke);
    }
    players.push({ id: pr.id, name: pr.name, team, reserve });
  }
  return players;
}

async function migrateLocalData(userId: string): Promise<Player[] | null> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const { players } = JSON.parse(saved);
    if (!players?.length) return null;

    const migrated: Player[] = [];
    for (const player of players as Player[]) {
      const { data: dbPlayer } = await supabase
        .from('players')
        .insert({ user_id: userId, name: player.name })
        .select('id')
        .single();
      if (!dbPlayer) continue;

      const newPlayer: Player = { id: dbPlayer.id, name: player.name, team: [], reserve: [] };

      for (const [index, poke] of player.team.entries()) {
        await supabase.from('pokemon_instances').insert(pokemonToRow(poke, dbPlayer.id, 'team', index));
        newPlayer.team.push(poke);
      }
      for (const [index, poke] of (player.reserve ?? []).entries()) {
        await supabase.from('pokemon_instances').insert(pokemonToRow(poke, dbPlayer.id, 'reserve', index));
        newPlayer.reserve.push(poke);
      }
      migrated.push(newPlayer);
    }

    localStorage.removeItem(STORAGE_KEY);
    return migrated;
  } catch {
    return null;
  }
}

// ---- Sync individual actions to Supabase ----

async function syncAddPlayer(userId: string, player: Player) {
  const { data } = await supabase
    .from('players')
    .insert({ id: player.id, user_id: userId, name: player.name })
    .select('id')
    .single();
  return data?.id ?? player.id;
}

async function syncRemovePlayer(playerId: string) {
  await supabase.from('players').delete().eq('id', playerId);
}

async function syncAddPokemon(playerId: string, pokemon: Pokemon, slotType: 'team' | 'reserve', slotIndex: number) {
  await supabase.from('pokemon_instances').insert(pokemonToRow(pokemon, playerId, slotType, slotIndex));
}

async function syncRemovePokemon(playerId: string, pokedexId: number) {
  await supabase.from('pokemon_instances').delete().eq('player_id', playerId).eq('pokedex_id', pokedexId);
}

async function syncUpdatePokemon(playerId: string, pokedexId: number, updates: Record<string, unknown>) {
  await supabase.from('pokemon_instances').update(updates).eq('player_id', playerId).eq('pokedex_id', pokedexId);
}

async function syncReorderTeam(playerId: string, team: Pokemon[]) {
  for (const [index, poke] of team.entries()) {
    await supabase.from('pokemon_instances')
      .update({ slot_index: index })
      .eq('player_id', playerId)
      .eq('pokedex_id', poke.id)
      .eq('slot_type', 'team');
  }
}

async function syncMovePokemon(playerId: string, pokedexId: number, newSlotType: 'team' | 'reserve', newIndex: number) {
  await supabase.from('pokemon_instances')
    .update({ slot_type: newSlotType, slot_index: newIndex })
    .eq('player_id', playerId)
    .eq('pokedex_id', pokedexId);
}

async function syncEvolvePokemon(playerId: string, oldPokedexId: number, evolvedPokemon: Pokemon, slotType: 'team' | 'reserve', slotIndex: number) {
  await supabase.from('pokemon_instances').delete().eq('player_id', playerId).eq('pokedex_id', oldPokedexId);
  await supabase.from('pokemon_instances').insert(pokemonToRow(evolvedPokemon, playerId, slotType, slotIndex));
}

// ---- Reducer (unchanged logic) ----

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADD_PLAYER':
      return {
        ...state,
        players: [...state.players, { id: crypto.randomUUID(), name: action.name, team: [], reserve: [] }],
      };
    case 'REMOVE_PLAYER':
      return {
        ...state,
        players: state.players.filter(p => p.id !== action.playerId),
      };
    case 'ADD_POKEMON': {
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          const allPokemon = [...p.team, ...p.reserve];
          if (allPokemon.some(pk => pk.id === action.pokemon.id)) return p;
          if (action.pokemon.evolutionChainId > 0) {
            const chainIds = getAllChainSpeciesIds(action.pokemon.evolutionChainId);
            if (chainIds.length > 0 && allPokemon.some(pk => chainIds.includes(pk.id))) return p;
          }
          if (p.team.length < 6) {
            return { ...p, team: [...p.team, action.pokemon] };
          }
          return { ...p, reserve: [...p.reserve, action.pokemon] };
        }),
      };
    }
    case 'REMOVE_POKEMON':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          return { ...p, team: p.team.filter(pk => pk.id !== action.pokemonId) };
        }),
      };
    case 'REMOVE_FROM_RESERVE':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          return { ...p, reserve: p.reserve.filter(pk => pk.id !== action.pokemonId) };
        }),
      };
    case 'MOVE_TO_RESERVE':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          const pokemon = p.team.find(pk => pk.id === action.pokemonId);
          if (!pokemon) return p;
          return {
            ...p,
            team: p.team.filter(pk => pk.id !== action.pokemonId),
            reserve: [...p.reserve, pokemon],
          };
        }),
      };
    case 'MOVE_TO_TEAM':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          if (p.team.length >= 6) return p;
          const pokemon = p.reserve.find(pk => pk.id === action.pokemonId);
          if (!pokemon) return p;
          return {
            ...p,
            reserve: p.reserve.filter(pk => pk.id !== action.pokemonId),
            team: [...p.team, pokemon],
          };
        }),
      };
    case 'REORDER_TEAM':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          const team = [...p.team];
          const [moved] = team.splice(action.fromIndex, 1);
          team.splice(action.toIndex, 0, moved);
          return { ...p, team };
        }),
      };
    case 'SET_LEVEL':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          const updateLevel = (pk: Pokemon) => {
            if (pk.id !== action.pokemonId) return pk;
            const gr = getGrowthRate(pk.growthRateId);
            const xp = gr ? getXpForLevel(gr, action.level) : pk.currentXp;
            return { ...pk, level: action.level, currentXp: xp };
          };
          return {
            ...p,
            team: p.team.map(updateLevel),
            reserve: p.reserve.map(updateLevel),
          };
        }),
      };
    case 'GAIN_XP':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          return {
            ...p,
            team: p.team.map(pk => {
              if (pk.id !== action.pokemonId) return pk;
              const newXp = pk.currentXp + action.xp;
              const growthRate = getGrowthRate(pk.growthRateId);
              const newLevel = growthRate ? Math.min(getLevelForXp(growthRate, newXp), 100) : pk.level;
              return { ...pk, currentXp: newXp, level: newLevel };
            }),
          };
        }),
      };
    case 'EVOLVE_POKEMON': {
      const startLevel = 5;
      const startGr = getGrowthRate(action.evolvedPokemon.growthRateId);
      const startXp = startGr ? getXpForLevel(startGr, startLevel) : 0;
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          const evolve = (pk: typeof action.evolvedPokemon) => {
            if (pk.id !== action.pokemonId) return pk;
            return {
              ...action.evolvedPokemon,
              level: startLevel,
              currentXp: startXp,
            };
          };
          return {
            ...p,
            team: p.team.map(evolve),
            reserve: p.reserve.map(evolve),
          };
        }),
      };
    }
    case 'SET_PENDING_EVOLUTION':
      return { ...state, pendingEvolution: action.evolution };
    case 'CLEAR_PENDING_EVOLUTION':
      return { ...state, pendingEvolution: null };
    case 'SET_BATTLE_RESULT':
      return { ...state, currentBattle: action.result };
    case 'CLEAR_BATTLE':
      return { ...state, currentBattle: null };
    case 'LOAD_STATE':
      return { ...state, players: action.players };
    default:
      return state;
  }
}

// ---- Context + Provider ----

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  loading: boolean;
} | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(gameReducer, { players: [], currentBattle: null, pendingEvolution: null });
  const [loading, setLoading] = useState(true);
  const prevStateRef = useRef(state);
  const userId = user?.id;

  // Load from Supabase on login
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      // Check if user has data in Supabase
      let players = await loadFromSupabase(userId);

      // If no data, try migrating from localStorage
      if (players.length === 0) {
        const migrated = await migrateLocalData(userId);
        if (migrated) {
          players = migrated;
        }
      }

      if (!cancelled) {
        // Hydrate state by dispatching a special load
        for (const p of state.players) {
          dispatch({ type: 'REMOVE_PLAYER', playerId: p.id });
        }
        // We need to set players directly — use a workaround via sequential adds
        // Actually, let's just reset by reloading
        prevStateRef.current = { players, currentBattle: null, pendingEvolution: null };
        dispatch({ type: 'LOAD_STATE', players });
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  // Sync actions to Supabase (fire-and-forget)
  const wrappedDispatch = useCallback((action: GameAction) => {
    dispatch(action);

    // Async sync — don't block UI
    if (!userId) return;

    (async () => {
      try {
        switch (action.type) {
          case 'ADD_PLAYER': {
            // We need to get the player that was just added
            // The reducer created it with crypto.randomUUID()
            // We'll sync it after state updates via the effect below
            break;
          }
          case 'REMOVE_PLAYER':
            await syncRemovePlayer(action.playerId);
            break;
          case 'ADD_POKEMON': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            if (!player) break;
            const allPokemon = [...player.team, ...player.reserve];
            if (allPokemon.some(pk => pk.id === action.pokemon.id)) break;
            const slotType = player.team.length < 6 ? 'team' : 'reserve';
            const slotIndex = slotType === 'team' ? player.team.length : player.reserve.length;
            await syncAddPokemon(action.playerId, action.pokemon, slotType, slotIndex);
            break;
          }
          case 'REMOVE_POKEMON':
            await syncRemovePokemon(action.playerId, action.pokemonId);
            break;
          case 'REMOVE_FROM_RESERVE':
            await syncRemovePokemon(action.playerId, action.pokemonId);
            break;
          case 'MOVE_TO_RESERVE': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            await syncMovePokemon(action.playerId, action.pokemonId, 'reserve', player?.reserve.length ?? 0);
            break;
          }
          case 'MOVE_TO_TEAM': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            await syncMovePokemon(action.playerId, action.pokemonId, 'team', player?.team.length ?? 0);
            break;
          }
          case 'REORDER_TEAM': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            if (!player) break;
            const team = [...player.team];
            const [moved] = team.splice(action.fromIndex, 1);
            team.splice(action.toIndex, 0, moved);
            await syncReorderTeam(action.playerId, team);
            break;
          }
          case 'SET_LEVEL': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            if (!player) break;
            const poke = [...player.team, ...player.reserve].find(pk => pk.id === action.pokemonId);
            if (!poke) break;
            const gr = getGrowthRate(poke.growthRateId);
            const xp = gr ? getXpForLevel(gr, action.level) : poke.currentXp;
            await syncUpdatePokemon(action.playerId, action.pokemonId, { level: action.level, current_xp: xp });
            break;
          }
          case 'GAIN_XP': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            if (!player) break;
            const poke = player.team.find(pk => pk.id === action.pokemonId);
            if (!poke) break;
            const newXp = poke.currentXp + action.xp;
            const growthRate = getGrowthRate(poke.growthRateId);
            const newLevel = growthRate ? Math.min(getLevelForXp(growthRate, newXp), 100) : poke.level;
            await syncUpdatePokemon(action.playerId, action.pokemonId, { current_xp: newXp, level: newLevel });
            break;
          }
          case 'EVOLVE_POKEMON': {
            const player = prevStateRef.current.players.find(p => p.id === action.playerId);
            if (!player) break;
            const inTeam = player.team.find(pk => pk.id === action.pokemonId);
            const inReserve = player.reserve.find(pk => pk.id === action.pokemonId);
            const slotType = inTeam ? 'team' : 'reserve';
            const slotIndex = inTeam
              ? player.team.indexOf(inTeam)
              : player.reserve.indexOf(inReserve!);
            const startGr = getGrowthRate(action.evolvedPokemon.growthRateId);
            const evolved = { ...action.evolvedPokemon, level: 5, currentXp: startGr ? getXpForLevel(startGr, 5) : 0 };
            await syncEvolvePokemon(action.playerId, action.pokemonId, evolved, slotType as 'team' | 'reserve', slotIndex);
            break;
          }
        }
      } catch (err) {
        console.error('Sync error:', err);
      }
    })();
  }, [userId]);

  // Sync new players that were just created (need the generated ID)
  useEffect(() => {
    if (!userId) return;
    const prev = prevStateRef.current;
    const newPlayers = state.players.filter(p => !prev.players.some(pp => pp.id === p.id));
    for (const p of newPlayers) {
      syncAddPlayer(userId, p);
    }
    prevStateRef.current = state;
  }, [state, userId]);

  return (
    <GameContext.Provider value={{ state, dispatch: wrappedDispatch, loading }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
