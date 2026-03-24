import type { PokemonStats } from '../types';

export function getEffectiveHp(base: number, level: number): number {
  return Math.floor((2 * base * level) / 100) + level + 10;
}

export function getEffectiveStat(base: number, level: number): number {
  return Math.floor((2 * base * level) / 100) + 5;
}

export function getEffectiveStats(baseStats: PokemonStats, level: number): PokemonStats {
  return {
    hp: getEffectiveHp(baseStats.hp, level),
    attack: getEffectiveStat(baseStats.attack, level),
    defense: getEffectiveStat(baseStats.defense, level),
    spAtk: getEffectiveStat(baseStats.spAtk, level),
    spDef: getEffectiveStat(baseStats.spDef, level),
    speed: getEffectiveStat(baseStats.speed, level),
  };
}
