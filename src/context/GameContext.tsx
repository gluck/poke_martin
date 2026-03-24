import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { GameState, GameAction } from '../types';
import { getGrowthRate, getLevelForXp } from '../api/evolution';

const STORAGE_KEY = 'poke_martin_state';

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { players: parsed.players ?? [], currentBattle: null, pendingEvolution: null };
    }
  } catch { /* ignore */ }
  return { players: [], currentBattle: null, pendingEvolution: null };
}

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
          if (p.team.length < 6) {
            return { ...p, team: [...p.team, action.pokemon] };
          }
          // Team full → add to reserve
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
    case 'EVOLVE_POKEMON':
      return {
        ...state,
        players: state.players.map(p => {
          if (p.id !== action.playerId) return p;
          return {
            ...p,
            team: p.team.map(pk => {
              if (pk.id !== action.pokemonId) return pk;
              // Replace with evolved Pokemon, keeping level/xp/growthRate
              return {
                ...action.evolvedPokemon,
                level: pk.level,
                currentXp: pk.currentXp,
                growthRateId: pk.growthRateId,
              };
            }),
          };
        }),
      };
    case 'SET_PENDING_EVOLUTION':
      return { ...state, pendingEvolution: action.evolution };
    case 'CLEAR_PENDING_EVOLUTION':
      return { ...state, pendingEvolution: null };
    case 'SET_BATTLE_RESULT':
      return { ...state, currentBattle: action.result };
    case 'CLEAR_BATTLE':
      return { ...state, currentBattle: null };
    default:
      return state;
  }
}

const GameContext = createContext<{ state: GameState; dispatch: React.Dispatch<GameAction> } | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: state.players }));
  }, [state.players]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
