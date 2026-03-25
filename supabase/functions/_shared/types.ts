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

export interface XpGain {
  pokemonId: number;
  pokemonName: string;
  xp: number;
  oldLevel: number;
  newLevel: number;
}

export interface BattleResult {
  player1: Player;
  player2: Player;
  rounds: BattleRound[];
  winner: Player | null;
  xpGains: XpGain[];
}
