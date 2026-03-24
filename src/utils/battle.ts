import type { Player, Pokemon, BattleRound, BattleResult, XpGain } from '../types';
import { getTypeMultiplier, describeEffectiveness } from '../data/typeChart';
import { getGrowthRate, getLevelForXp } from '../api/evolution';

function calculateDamage(
  attacker: Pokemon,
  defender: Pokemon
): { damage: number; effectiveness: string } {
  const atk = Math.max(attacker.stats.attack, attacker.stats.spAtk);
  const def = Math.max(defender.stats.defense, defender.stats.spDef);
  const baseDamage = Math.floor((atk / def) * 40 + 5);
  const typeMultiplier = getTypeMultiplier(attacker.types, defender.types);
  const random = 0.85 + Math.random() * 0.15;
  const finalDamage = Math.max(1, Math.floor(baseDamage * typeMultiplier * random));
  return { damage: finalDamage, effectiveness: describeEffectiveness(typeMultiplier) };
}

function displayName(poke: Pokemon): string {
  const name = poke.frenchName || poke.name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function executeBattle(player1: Player, player2: Player): BattleResult {
  const rounds: BattleRound[] = [];
  let roundNumber = 0;

  // Clone HP pools
  const hp1 = player1.team.map(p => p.stats.hp);
  const hp2 = player2.team.map(p => p.stats.hp);
  let idx1 = 0;
  let idx2 = 0;

  while (idx1 < player1.team.length && idx2 < player2.team.length) {
    roundNumber++;
    const poke1 = player1.team[idx1];
    const poke2 = player2.team[idx2];

    // Faster Pokemon attacks first
    const p1First = poke1.stats.speed >= poke2.stats.speed;
    const first = p1First ? { poke: poke1, player: player1, hp: hp1, idx: idx1, side: 1 } : { poke: poke2, player: player2, hp: hp2, idx: idx2, side: 2 };
    const second = p1First ? { poke: poke2, player: player2, hp: hp2, idx: idx2, side: 2 } : { poke: poke1, player: player1, hp: hp1, idx: idx1, side: 1 };

    // First attacker strikes
    const hit1 = calculateDamage(first.poke, second.poke);
    second.hp[second.idx] = Math.max(0, second.hp[second.idx] - hit1.damage);

    let fainted: string | null = null;
    if (second.hp[second.idx] <= 0) {
      fainted = displayName(second.poke);
    }

    rounds.push({
      roundNumber,
      attacker: { playerName: first.player.name, pokemon: first.poke },
      defender: { playerName: second.player.name, pokemon: second.poke },
      damage: hit1.damage,
      effectiveness: hit1.effectiveness,
      attackerHp: first.hp[first.idx],
      defenderHp: second.hp[second.idx],
      fainted,
      description: `${displayName(first.poke)} inflige ${hit1.damage} degats a ${displayName(second.poke)} !${hit1.effectiveness !== 'normal' ? ` C'est ${hit1.effectiveness} !` : ''}${fainted ? ` ${fainted} est K.O. !` : ''}`,
    });

    if (fainted) {
      if (second.side === 1) idx1++;
      else idx2++;
      continue;
    }

    // Second attacker counter-strikes
    roundNumber++;
    const hit2 = calculateDamage(second.poke, first.poke);
    first.hp[first.idx] = Math.max(0, first.hp[first.idx] - hit2.damage);

    let fainted2: string | null = null;
    if (first.hp[first.idx] <= 0) {
      fainted2 = displayName(first.poke);
    }

    rounds.push({
      roundNumber,
      attacker: { playerName: second.player.name, pokemon: second.poke },
      defender: { playerName: first.player.name, pokemon: first.poke },
      damage: hit2.damage,
      effectiveness: hit2.effectiveness,
      attackerHp: second.hp[second.idx],
      defenderHp: first.hp[first.idx],
      fainted: fainted2,
      description: `${displayName(second.poke)} inflige ${hit2.damage} degats a ${displayName(first.poke)} !${hit2.effectiveness !== 'normal' ? ` C'est ${hit2.effectiveness} !` : ''}${fainted2 ? ` ${fainted2} est K.O. !` : ''}`,
    });

    if (fainted2) {
      if (first.side === 1) idx1++;
      else idx2++;
    }
  }

  const winner = idx1 >= player1.team.length ? player2 : idx2 >= player2.team.length ? player1 : null;

  // Compute XP gains for winning team's Pokemon
  const xpGains: XpGain[] = [];
  if (winner) {
    const winnerTeam = winner === player1 ? player1.team : player2.team;
    const loserTeam = winner === player1 ? player2.team : player1.team;

    // Each winning Pokemon earns XP from the opponents it helped defeat
    // Simple approach: distribute total XP equally among surviving winners
    const totalXp = loserTeam.reduce((sum, p) => {
      const scaledXp = Math.floor(p.baseExperience * (p.level / 5) * 1.5);
      return sum + Math.max(scaledXp, 10);
    }, 0);
    const xpPerPokemon = Math.floor(totalXp / winnerTeam.length);

    for (const poke of winnerTeam) {
      const newXp = poke.currentXp + xpPerPokemon;
      const growthRate = getGrowthRate(poke.growthRateId);
      const newLevel = growthRate ? getLevelForXp(growthRate, newXp) : poke.level;
      xpGains.push({
        pokemonId: poke.id,
        pokemonName: poke.frenchName || poke.name,
        xp: xpPerPokemon,
        oldLevel: poke.level,
        newLevel: Math.min(newLevel, 100),
      });
    }
  }

  return { player1, player2, rounds, winner, xpGains };
}
