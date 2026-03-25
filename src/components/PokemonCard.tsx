import { useRef, useState } from 'react';
import type { Pokemon, Player } from '../types';
import { TypeBadge } from './TypeBadge';
import { StatBar } from './StatBar';
import { getGrowthRate, getXpToNextLevel, getEvolutionNeighbors } from '../api/evolution';
import { lookupFrenchName } from '../api/frenchNames';
import { getEffectiveStats } from '../utils/stats';
import './PokemonCard.css';

interface PokemonCardProps {
  pokemon: Pokemon;
  players?: Player[];
  onAddToPlayer?: (playerId: string) => void;
  onRemove?: () => void;
  onLevelUp?: () => void;
  onEvolve?: (speciesId: number) => void;
  compact?: boolean;
}

const isDev = import.meta.env.DEV;

function spriteUrl(speciesId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`;
}

export function PokemonCard({ pokemon, players, onAddToPlayer, onRemove, onLevelUp, onEvolve, compact }: PokemonCardProps) {
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

  const neighbors = pokemon.evolutionChainId > 0
    ? getEvolutionNeighbors(pokemon.evolutionChainId, pokemon.name, pokemon.id)
    : null;
  const hasEvoLinks = onEvolve && neighbors && (neighbors.prev || neighbors.next.length > 0 || neighbors.megas.length > 0);
  const effectiveStats = showLevel ? getEffectiveStats(pokemon.stats, pokemon.level) : pokemon.stats;

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
          {showLevel && (
            isDev && onLevelUp ? (
              <button className="pokemon-level dev-clickable" onClick={onLevelUp} title="[DEV] +1 niveau">
                Nv. {pokemon.level}
              </button>
            ) : (
              <span className="pokemon-level">Nv. {pokemon.level}</span>
            )
          )}
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
        <div className="pokemon-stats">
          {statKeys.map(k => (
            <StatBar key={k} statKey={k} value={effectiveStats[k]} />
          ))}
        </div>
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
          {hasEvoLinks && neighbors.prev && (
            <button
              className="evo-link evo-prev"
              onClick={() => onEvolve!(neighbors.prev!.speciesId)}
              title={lookupFrenchName(neighbors.prev.speciesName)}
            >
              <img src={spriteUrl(neighbors.prev.speciesId)} alt={neighbors.prev.speciesName} />
            </button>
          )}
          {hasEvoLinks && neighbors.next.map(evo => (
            <button
              key={evo.speciesId}
              className="evo-link evo-next"
              onClick={() => onEvolve!(evo.speciesId)}
              title={lookupFrenchName(evo.speciesName)}
            >
              <img src={spriteUrl(evo.speciesId)} alt={evo.speciesName} />
            </button>
          ))}
          {hasEvoLinks && neighbors.megas.map(mega => (
            <button
              key={mega.speciesId}
              className="evo-link evo-mega"
              onClick={() => onEvolve!(mega.speciesId)}
              title={mega.label ?? mega.speciesName}
            >
              <img src={spriteUrl(mega.speciesId)} alt={mega.speciesName} />
            </button>
          ))}
          {onRemove && (
            <button className="remove-btn" onClick={() => {
              const name = pokemon.frenchName || pokemon.name;
              if (pokemon.level > 5) {
                if (!window.confirm(`${name} est Nv. ${pokemon.level}. Le supprimer ?`)) return;
              }
              onRemove();
            }} title="Retirer">
              &times;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
