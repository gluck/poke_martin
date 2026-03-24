import { useRef, useState } from 'react';
import type { Pokemon, Player } from '../types';
import { TypeBadge } from './TypeBadge';
import { StatBar } from './StatBar';
import { getGrowthRate, getXpToNextLevel } from '../api/evolution';
import './PokemonCard.css';

interface PokemonCardProps {
  pokemon: Pokemon;
  players?: Player[];
  onAddToPlayer?: (playerId: string) => void;
  onRemove?: () => void;
  compact?: boolean;
}

export function PokemonCard({ pokemon, players, onAddToPlayer, onRemove, compact }: PokemonCardProps) {
  const statKeys = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'] as const;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const playCry = () => {
    if (!pokemon.cryUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(pokemon.cryUrl);
    audioRef.current = audio;
    setPlaying(true);
    audio.play();
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
  };

  const abilitiesTooltip = pokemon.abilities?.length
    ? pokemon.abilities.join(', ')
    : '';

  const growthRate = getGrowthRate(pokemon.growthRateId);
  const xpProgress = growthRate ? getXpToNextLevel(growthRate, pokemon.currentXp, pokemon.level) : null;
  const showLevel = pokemon.level > 0;

  return (
    <div className={`pokemon-card${compact ? ' compact' : ''}`}>
      <div className="sprite-wrapper">
        <img src={pokemon.sprite} alt={pokemon.frenchName || pokemon.name} className="pokemon-sprite" />
        {pokemon.cryUrl && (
          <button
            className={`cry-btn${playing ? ' playing' : ''}`}
            onClick={playCry}
            title="Ecouter le cri"
          >
            {playing ? '\u{1F50A}' : '\u{1F509}'}
          </button>
        )}
      </div>
      <div className="pokemon-info">
        <h3 className="pokemon-name">
          <span className="pokemon-id">#{pokemon.id}</span>
          {pokemon.frenchName || pokemon.name}
          {showLevel && <span className="pokemon-level">Nv. {pokemon.level}</span>}
        </h3>
        {showLevel && xpProgress && (
          <div
            className="xp-bar-wrapper"
            title={`XP : ${pokemon.currentXp} / ${xpProgress.nextLevelXp} — Prochain niveau : ${xpProgress.nextLevelXp - pokemon.currentXp} XP restants`}
          >
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: `${xpProgress.progress * 100}%` }} />
            </div>
          </div>
        )}
        <div className="pokemon-types">
          {pokemon.types.map(t => <TypeBadge key={t} type={t} />)}
        </div>
        {abilitiesTooltip && (
          <div className="pokemon-abilities" title={abilitiesTooltip}>
            <span className="abilities-label">Talents :</span> {abilitiesTooltip}
          </div>
        )}
        {!compact && (
          <div className="pokemon-stats">
            {statKeys.map(k => (
              <StatBar key={k} statKey={k} value={pokemon.stats[k]} />
            ))}
          </div>
        )}
        <div className="pokemon-actions">
          {onAddToPlayer && players && players.length > 0 && (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) onAddToPlayer(e.target.value); e.target.value = ''; }}
              className="add-to-player-select"
            >
              <option value="" disabled>Ajouter au joueur...</option>
              {players.map(p => {
                const total = p.team.length + (p.reserve?.length ?? 0);
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.team.length}/6{total > p.team.length ? ` +${p.reserve.length}` : ''})
                  </option>
                );
              })}
            </select>
          )}
          {onRemove && (
            <button className="remove-btn" onClick={onRemove} title="Retirer">
              &times;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
