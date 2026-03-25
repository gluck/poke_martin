import { useState, useEffect, useRef, useMemo } from 'react';
import type { BattleResult, Pokemon } from '../types';
import './BattleLog.css';

const ROUND_DELAY_MS = 1200;

function playCry(url: string | null | undefined) {
  if (!url) return;
  try {
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play();
  } catch { /* ignore */ }
}

function spriteUrl(pokedexId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
}

interface BattleLogProps {
  result: BattleResult;
  onClose: () => void;
  onXpAwarded?: () => void;
}

export function BattleLog({ result, onClose, onXpAwarded }: BattleLogProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [showXp, setShowXp] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(false);
  const roundsRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const totalRounds = result.rounds.length;
  const battleDone = visibleCount >= totalRounds;

  // Compute KO'd and active Pokemon based on visible rounds
  const { faintedIds, activeP1Id, activeP2Id } = useMemo(() => {
    const fainted = new Set<number>();
    let lastP1: Pokemon | null = null;
    let lastP2: Pokemon | null = null;

    for (let i = 0; i < visibleCount; i++) {
      const round = result.rounds[i];
      // Track which Pokemon from which side are fighting
      const atkPoke = round.attacker.pokemon;
      const defPoke = round.defender.pokemon;

      if (round.attacker.playerName === result.player1.name) {
        lastP1 = atkPoke;
        lastP2 = defPoke;
      } else {
        lastP1 = defPoke;
        lastP2 = atkPoke;
      }

      if (round.fainted) {
        // Find which pokemon fainted by name match
        const faintedName = round.fainted;
        const p1Match = result.player1.team.find(p => {
          const dn = p.frenchName || p.name;
          return dn.charAt(0).toUpperCase() + dn.slice(1) === faintedName;
        });
        const p2Match = result.player2.team.find(p => {
          const dn = p.frenchName || p.name;
          return dn.charAt(0).toUpperCase() + dn.slice(1) === faintedName;
        });
        if (p1Match) fainted.add(p1Match.id);
        if (p2Match) fainted.add(p2Match.id);
      }
    }

    return {
      faintedIds: fainted,
      activeP1Id: lastP1?.id ?? result.player1.team[0]?.id,
      activeP2Id: lastP2?.id ?? result.player2.team[0]?.id,
    };
  }, [visibleCount, result]);

  useEffect(() => {
    if (visibleCount < totalRounds) {
      timerRef.current = setTimeout(() => {
        const round = result.rounds[visibleCount];
        playCry(round.attacker.pokemon.cryUrl);
        setVisibleCount(c => c + 1);
      }, visibleCount === 0 ? 400 : ROUND_DELAY_MS);
    } else if (battleDone && !showWinner) {
      timerRef.current = setTimeout(() => setShowWinner(true), 600);
    } else if (showWinner && !showXp && result.xpGains.length > 0) {
      timerRef.current = setTimeout(() => setShowXp(true), 800);
    }
    return () => clearTimeout(timerRef.current);
  }, [visibleCount, totalRounds, battleDone, showWinner, showXp, result.rounds, result.xpGains]);

  useEffect(() => {
    if (roundsRef.current) {
      roundsRef.current.scrollTop = roundsRef.current.scrollHeight;
    }
  }, [visibleCount, showXp]);

  useEffect(() => {
    if (showXp && !xpAwarded) {
      setXpAwarded(true);
      onXpAwarded?.();
    }
  }, [showXp, xpAwarded, onXpAwarded]);

  const skipToEnd = () => {
    setVisibleCount(totalRounds);
    setShowWinner(true);
    if (result.xpGains.length > 0) {
      setShowXp(true);
    }
  };

  const renderTeamBanner = (team: Pokemon[], playerName: string, activeId: number | undefined) => (
    <div className="team-banner">
      <span className="team-banner-name">{playerName}</span>
      <div className="team-banner-slots">
        {team.map(poke => {
          const isActive = poke.id === activeId;
          const isKo = faintedIds.has(poke.id);
          return (
            <div
              key={poke.id}
              className={`team-banner-poke${isActive ? ' active' : ''}${isKo ? ' ko' : ''}`}
              title={`${poke.frenchName || poke.name} Nv.${poke.level}${isKo ? ' (K.O.)' : ''}`}
            >
              <img src={poke.sprite || spriteUrl(poke.id)} alt={poke.frenchName || poke.name} />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="battle-log-overlay" onClick={onClose}>
      <div className="battle-log" onClick={e => e.stopPropagation()}>
        <div className="battle-log-header">
          <h3>Combat : {result.player1.name} vs {result.player2.name}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="team-banners">
          {renderTeamBanner(result.player1.team, result.player1.name, activeP1Id)}
          <span className="banners-vs">VS</span>
          {renderTeamBanner(result.player2.team, result.player2.name, activeP2Id)}
        </div>

        <div className="battle-rounds" ref={roundsRef}>
          {result.rounds.slice(0, visibleCount).map((round) => (
            <div
              key={round.roundNumber}
              className={`battle-round ${round.fainted ? 'has-faint' : ''} ${round.effectiveness === 'super efficace' ? 'super-effective' : ''}`}
            >
              <span className="round-number">#{round.roundNumber}</span>
              <span className="round-description">{round.description}</span>
              <div className="round-hp">
                <span className="hp-bar">
                  {round.attacker.pokemon.frenchName || round.attacker.pokemon.name}: {round.attackerHp}pv
                </span>
                <span className="hp-bar">
                  {round.defender.pokemon.frenchName || round.defender.pokemon.name}: {round.defenderHp}pv
                </span>
              </div>
            </div>
          ))}

          {showXp && result.xpGains.length > 0 && (
            <div className="xp-gains-section">
              <div className="xp-gains-title">Experience gagnee :</div>
              {result.xpGains.map(gain => (
                <div key={gain.pokemonId} className="xp-gain-entry">
                  <span className="xp-pokemon-name">{gain.pokemonName}</span>
                  <span className="xp-amount">+{gain.xp} XP</span>
                  {gain.newLevel > gain.oldLevel && (
                    <span className="level-up-badge">
                      Nv. {gain.oldLevel} → {gain.newLevel} !
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {!battleDone && (
            <div className="battle-waiting">
              <span className="waiting-dots" />
            </div>
          )}
        </div>

        {showWinner ? (
          <div className={`battle-winner ${result.winner ? 'has-winner' : ''}`}>
            {result.winner
              ? `${result.winner.name} remporte le combat !`
              : 'Match nul !'
            }
          </div>
        ) : (
          <div className="battle-footer">
            <button className="skip-btn" onClick={skipToEnd}>
              Passer &raquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
