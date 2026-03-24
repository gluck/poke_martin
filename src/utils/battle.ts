import type { Player, Pokemon, BattleRound, BattleResult, XpGain } from '../types';
import { getTypeMultiplier, describeEffectiveness } from '../data/typeChart';
import { getGrowthRate, getLevelForXp } from '../api/evolution';
import { getEffectiveStats } from './stats';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Attack verbs by Pokemon primary type ----

const typeVerbs: Record<string, string[]> = {
  fire: ['crame', 'brule', 'calcine', 'embrase'],
  water: ['asperge', 'trempe', 'submerge', 'eclabousse'],
  electric: ['electrocute', 'foudroie', 'electrise', 'paralyse'],
  grass: ['fouette', 'enlace', 'lacere', 'flagelle'],
  ice: ['gele', 'congele', 'givre', 'glace'],
  fighting: ['frappe', 'cogne', 'martele', 'percute'],
  poison: ['empoisonne', 'intoxique', 'contamine', 'infecte'],
  ground: ['ensevelit', 'ecrase', 'enterre', 'enfouit'],
  flying: ['percute', 'plonge sur', 'balaye', 'fonce sur'],
  psychic: ['deboussole', 'confond', 'destabilise', 'perturbe'],
  bug: ['pique', 'mord', 'devore', 'grignote'],
  rock: ['ecrase', 'lapide', 'bombarde', 'pilonne'],
  ghost: ['hante', 'terrifie', 'maudit', 'tourmente'],
  dragon: ['dechaine sa fureur sur', 'decime', 'pulverise', 'devaste'],
  dark: ['fauche', 'embusque', 'traque', 'assomme'],
  steel: ['percute', 'taillade', 'transperce', 'lacere'],
  fairy: ['ensorcele', 'enchante', 'eblouit', 'charme'],
  normal: ['attaque', 'charge', 'plaque', 'bouscule'],
};

function getAttackVerb(attacker: Pokemon): string {
  const primaryType = attacker.types[0] || 'normal';
  const verbs = typeVerbs[primaryType] || typeVerbs.normal;
  return pick(verbs);
}

// ---- Damage intensity phrases ----

function getDamagePhrase(damage: number, defenderMaxHp: number): string {
  const ratio = damage / defenderMaxHp;
  if (ratio > 0.7) return pick(['DEVASTATEUR !', 'COUP CRITIQUE !', 'ENORME !']);
  if (ratio > 0.4) return pick(['Un coup puissant !', 'Ca fait mal !', 'Bien touche !']);
  if (ratio < 0.15) return pick(['Une egratignure.', 'A peine touche.', 'Un petit coup.']);
  return '';
}

// ---- Effectiveness phrases ----

function getEffectivenessPhrase(effectiveness: string): string {
  if (effectiveness === 'super efficace') return pick(["C'est super efficace !", 'Ca fait tres mal !', 'Le point faible !', 'Touche en plein dans le mille !']);
  if (effectiveness === 'peu efficace') return pick(["Ce n'est pas tres efficace...", "L'attaque est amortie...", 'Ca glisse...', 'Presque aucun effet...']);
  if (effectiveness === 'aucun effet') return pick(["Ca n'a aucun effet !", "L'attaque passe au travers !", 'Completement immunise !']);
  return '';
}

// ---- KO phrases ----

function getKOPhrase(name: string): string {
  return pick([
    `${name} est K.O. !`,
    `${name} s'effondre !`,
    `${name} ne peut plus combattre !`,
    `${name} est hors combat !`,
    `${name} tombe au sol !`,
  ]);
}

// ---- Level advantage flavor ----

function getLevelFlavor(attacker: Pokemon, defender: Pokemon): string {
  const diff = attacker.level - defender.level;
  if (diff >= 15) return pick([' sans effort', ' comme si de rien', " d'un geste", ' avec dedain']);
  if (diff <= -15) return pick([' contre toute attente', ' malgre le desavantage', ' avec courage']);
  return '';
}

// ---- Build full description ----

function buildDescription(
  attacker: Pokemon,
  defender: Pokemon,
  damage: number,
  effectiveness: string,
  fainted: string | null,
  defenderMaxHp: number,
): string {
  const atkName = displayName(attacker);
  const defName = displayName(defender);
  const verb = getAttackVerb(attacker);
  const levelFlavor = getLevelFlavor(attacker, defender);

  let text = `${atkName} ${verb} ${defName}${levelFlavor} !`;

  const intensite = getDamagePhrase(damage, defenderMaxHp);
  if (intensite) {
    text += ` ${intensite}`;
  }
  text += ` (${damage} degats)`;

  const effPhrase = getEffectivenessPhrase(effectiveness);
  if (effPhrase) {
    text += ` ${effPhrase}`;
  }

  if (fainted) {
    text += ` ${fainted}`;
  }

  return text;
}

// ---- Core battle logic ----

function calculateDamage(
  attacker: Pokemon,
  defender: Pokemon
): { damage: number; effectiveness: string } {
  const atkStats = getEffectiveStats(attacker.stats, attacker.level);
  const defStats = getEffectiveStats(defender.stats, defender.level);
  const atk = Math.max(atkStats.attack, atkStats.spAtk);
  const def = Math.max(defStats.defense, defStats.spDef);
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

  const hp1 = player1.team.map(p => getEffectiveStats(p.stats, p.level).hp);
  const hp2 = player2.team.map(p => getEffectiveStats(p.stats, p.level).hp);
  let idx1 = 0;
  let idx2 = 0;

  while (idx1 < player1.team.length && idx2 < player2.team.length) {
    roundNumber++;
    const poke1 = player1.team[idx1];
    const poke2 = player2.team[idx2];

    const p1First = poke1.stats.speed >= poke2.stats.speed;
    const first = p1First ? { poke: poke1, player: player1, hp: hp1, idx: idx1, side: 1 } : { poke: poke2, player: player2, hp: hp2, idx: idx2, side: 2 };
    const second = p1First ? { poke: poke2, player: player2, hp: hp2, idx: idx2, side: 2 } : { poke: poke1, player: player1, hp: hp1, idx: idx1, side: 1 };

    // First attacker strikes
    const hit1 = calculateDamage(first.poke, second.poke);
    second.hp[second.idx] = Math.max(0, second.hp[second.idx] - hit1.damage);

    let fainted: string | null = null;
    if (second.hp[second.idx] <= 0) {
      fainted = getKOPhrase(displayName(second.poke));
    }

    rounds.push({
      roundNumber,
      attacker: { playerName: first.player.name, pokemon: first.poke },
      defender: { playerName: second.player.name, pokemon: second.poke },
      damage: hit1.damage,
      effectiveness: hit1.effectiveness,
      attackerHp: first.hp[first.idx],
      defenderHp: second.hp[second.idx],
      fainted: fainted ? displayName(second.poke) : null,
      description: buildDescription(first.poke, second.poke, hit1.damage, hit1.effectiveness, fainted, getEffectiveStats(second.poke.stats, second.poke.level).hp),
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
      fainted2 = getKOPhrase(displayName(first.poke));
    }

    rounds.push({
      roundNumber,
      attacker: { playerName: second.player.name, pokemon: second.poke },
      defender: { playerName: first.player.name, pokemon: first.poke },
      damage: hit2.damage,
      effectiveness: hit2.effectiveness,
      attackerHp: second.hp[second.idx],
      defenderHp: first.hp[first.idx],
      fainted: fainted2 ? displayName(first.poke) : null,
      description: buildDescription(second.poke, first.poke, hit2.damage, hit2.effectiveness, fainted2, getEffectiveStats(first.poke.stats, first.poke.level).hp),
    });

    if (fainted2) {
      if (first.side === 1) idx1++;
      else idx2++;
    }
  }

  const winner = idx1 >= player1.team.length ? player2 : idx2 >= player2.team.length ? player1 : null;

  const xpGains: XpGain[] = [];
  if (winner) {
    const winnerTeam = winner === player1 ? player1.team : player2.team;
    const loserTeam = winner === player1 ? player2.team : player1.team;

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
