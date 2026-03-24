// ---- API response shapes ----

export interface PokeAPIPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  cries: {
    latest: string;
    legacy: string;
  };
  sprites: {
    front_default: string;
    other: {
      'official-artwork': {
        front_default: string;
      };
    };
  };
  stats: {
    base_stat: number;
    stat: { name: string };
  }[];
  types: {
    slot: number;
    type: { name: string };
  }[];
  abilities: {
    ability: { name: string };
    is_hidden: boolean;
  }[];
}

export interface PokeAPIListResponse {
  count: number;
  results: { name: string; url: string }[];
}

// ---- App domain types ----

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  spAtk: number;
  spDef: number;
  speed: number;
}

export interface Pokemon {
  id: number;
  name: string;
  frenchName: string;
  sprite: string;
  types: string[];
  stats: PokemonStats;
  abilities: string[];
  cryUrl: string | null;
  baseExperience: number;
  level: number;
  currentXp: number;
  growthRateId: string;
  evolutionChainId: number;
}

export interface FrenchNameEntry {
  id: number;
  englishName: string;
  frenchName: string;
}

export interface GrowthRate {
  name: string;
  levels: { level: number; experience: number }[];
}

export interface EvolutionStep {
  speciesName: string;
  speciesId: number;
  minLevel: number | null;
  evolvesTo: EvolutionStep[];
}

export interface PendingEvolution {
  playerId: string;
  pokemonId: number;
  fromName: string;
  fromFrenchName: string;
  fromSprite: string;
  intoSpeciesId: number;
  intoName: string;
  intoFrenchName: string;
  intoSprite: string;
}

export interface XpGain {
  pokemonId: number;
  pokemonName: string;
  xp: number;
  oldLevel: number;
  newLevel: number;
}

export interface Player {
  id: string;
  name: string;
  team: Pokemon[];
  reserve: Pokemon[];
}

export interface BattleRound {
  roundNumber: number;
  attacker: { playerName: string; pokemon: Pokemon };
  defender: { playerName: string; pokemon: Pokemon };
  damage: number;
  effectiveness: string;
  attackerHp: number;
  defenderHp: number;
  fainted: string | null;
  description: string;
}

export interface BattleResult {
  player1: Player;
  player2: Player;
  rounds: BattleRound[];
  winner: Player | null;
  xpGains: XpGain[];
}

// ---- State management ----

export interface GameState {
  players: Player[];
  currentBattle: BattleResult | null;
  pendingEvolution: PendingEvolution | null;
}

export type GameAction =
  | { type: 'ADD_PLAYER'; name: string }
  | { type: 'REMOVE_PLAYER'; playerId: string }
  | { type: 'ADD_POKEMON'; playerId: string; pokemon: Pokemon }
  | { type: 'REMOVE_POKEMON'; playerId: string; pokemonId: number }
  | { type: 'REORDER_TEAM'; playerId: string; fromIndex: number; toIndex: number }
  | { type: 'MOVE_TO_RESERVE'; playerId: string; pokemonId: number }
  | { type: 'MOVE_TO_TEAM'; playerId: string; pokemonId: number }
  | { type: 'REMOVE_FROM_RESERVE'; playerId: string; pokemonId: number }
  | { type: 'GAIN_XP'; playerId: string; pokemonId: number; xp: number }
  | { type: 'SET_LEVEL'; playerId: string; pokemonId: number; level: number }
  | { type: 'EVOLVE_POKEMON'; playerId: string; pokemonId: number; evolvedPokemon: Pokemon }
  | { type: 'SET_PENDING_EVOLUTION'; evolution: PendingEvolution }
  | { type: 'CLEAR_PENDING_EVOLUTION' }
  | { type: 'SET_BATTLE_RESULT'; result: BattleResult }
  | { type: 'CLEAR_BATTLE' };
