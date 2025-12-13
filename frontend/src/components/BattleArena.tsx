import { useState, useEffect, useMemo } from 'react';
import { ActivePokemon, BattleField, TeamMember, MoveAnnouncement, getSpriteUrlsWithFallbacks } from '../lib/pokemon';
import { PokemonAnimationState, getAnimationClasses } from '../hooks/useAnimationState';
import { TeamIndicator } from './TeamIndicator';
import './BattleArena.css';

interface BattleArenaProps {
  p1Pokemon: ActivePokemon | null;
  p2Pokemon: ActivePokemon | null;
  p1Team: TeamMember[];
  p2Team: TeamMember[];
  field: BattleField;
  p1LastMove: MoveAnnouncement | null;
  p2LastMove: MoveAnnouncement | null;
  p1Label: string;
  p2Label: string;
  p1Animation?: PokemonAnimationState;
  p2Animation?: PokemonAnimationState;
}

export function BattleArena({
  p1Pokemon,
  p2Pokemon,
  p1Team,
  p2Team,
  field,
  p1LastMove,
  p2LastMove,
  p1Label,
  p2Label,
  p1Animation,
  p2Animation,
}: BattleArenaProps) {
  return (
    <div className={`battle-scene ${getWeatherClass(field.weather)}`}>
      {/* Weather overlay */}
      {field.weather && <div className="weather-badge">{formatWeather(field.weather)}</div>}
      {field.terrain && <div className="terrain-badge">{field.terrain}</div>}

      {/* Opponent area - TOP */}
      <div className="battle-side opponent-side">
        <div className="team-area opponent">
          <TeamIndicator team={p2Team} side="opponent" />
          <span className="trainer-name">{p2Label}</span>
        </div>

        <div className="pokemon-area opponent">
          {p2Pokemon ? (
            <>
              <div className="sprite-area opponent">
                <PokemonSprite pokemon={p2Pokemon} isBack={false} animation={p2Animation} side="opponent" />
                <div className="shadow opponent" />
              </div>
              <PokemonInfo pokemon={p2Pokemon} side="opponent" />
            </>
          ) : (
            <div className="waiting-pokemon">Waiting for Pokemon...</div>
          )}
        </div>
      </div>

      {/* Player area - BOTTOM */}
      <div className="battle-side player-side">
        <div className="pokemon-area player">
          {p1Pokemon ? (
            <>
              <div className="sprite-area player">
                <div className="shadow player" />
                <PokemonSprite pokemon={p1Pokemon} isBack={true} animation={p1Animation} side="player" />
              </div>
              <PokemonInfo pokemon={p1Pokemon} side="player" />
            </>
          ) : (
            <div className="waiting-pokemon">Waiting for Pokemon...</div>
          )}
        </div>

        <div className="team-area player">
          <span className="trainer-name">{p1Label}</span>
          <TeamIndicator team={p1Team} side="player" />
        </div>
      </div>

      {/* Move announcements - one for each side */}
      {p1LastMove && (
        <div className="move-announcement p1">
          {p1LastMove.pokemon} used <strong>{p1LastMove.move}</strong>!
        </div>
      )}
      {p2LastMove && (
        <div className="move-announcement p2">
          {p2LastMove.pokemon} used <strong>{p2LastMove.move}</strong>!
        </div>
      )}
    </div>
  );
}

interface PokemonSpriteProps {
  pokemon: ActivePokemon;
  isBack: boolean;
  animation?: PokemonAnimationState;
  side: 'player' | 'opponent';
}

function PokemonSprite({ pokemon, isBack, animation, side }: PokemonSpriteProps) {
  const [urlIndex, setUrlIndex] = useState(0);

  // Get list of sprite URLs to try in order
  const spriteUrls = useMemo(
    () => getSpriteUrlsWithFallbacks(pokemon.species, isBack),
    [pokemon.species, isBack]
  );

  // Reset to first URL when species changes
  useEffect(() => {
    setUrlIndex(0);
  }, [pokemon.species]);

  const handleError = () => {
    // Try next URL in the fallback chain
    if (urlIndex < spriteUrls.length - 1) {
      setUrlIndex(urlIndex + 1);
    }
  };

  // Build animation classes
  const animationClasses = animation ? getAnimationClasses(animation, side) : '';
  const faintedClass = pokemon.fainted ? 'fainted' : '';

  return (
    <div className={`pokemon-sprite-container ${faintedClass} ${animationClasses}`.trim()}>
      <img
        src={spriteUrls[urlIndex]}
        alt={pokemon.species}
        className={`pokemon-sprite ${isBack ? 'back' : 'front'}`}
        onError={handleError}
      />
      {pokemon.fainted && <div className="fainted-x">X</div>}
    </div>
  );
}

interface PokemonInfoProps {
  pokemon: ActivePokemon;
  side: 'player' | 'opponent';
}

function PokemonInfo({ pokemon, side }: PokemonInfoProps) {
  return (
    <div className={`pokemon-info-box ${side}`}>
      <div className="info-header">
        <span className="pokemon-name">{pokemon.name}</span>
        <span className="pokemon-level">Lv{pokemon.level}</span>
      </div>

      <div className="hp-bar-wrapper">
        <div className="hp-bar-bg">
          <div
            className={`hp-bar-fill ${getHpColor(pokemon.hpPercent)}`}
            style={{ width: `${pokemon.hpPercent}%` }}
          />
        </div>
        <span className="hp-text">
          {pokemon.hp}/{pokemon.maxHp}
        </span>
      </div>

      <div className="status-row">
        {pokemon.status && <StatusBadge status={pokemon.status} />}
        <BoostIndicators boosts={pokemon.boosts} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusInfo: Record<string, { label: string; color: string }> = {
    brn: { label: 'BRN', color: '#f08030' },
    par: { label: 'PAR', color: '#f8d030' },
    psn: { label: 'PSN', color: '#a040a0' },
    tox: { label: 'TOX', color: '#a040a0' },
    slp: { label: 'SLP', color: '#a8a878' },
    frz: { label: 'FRZ', color: '#98d8d8' },
  };

  const info = statusInfo[status] || { label: status.toUpperCase(), color: '#888' };

  return (
    <span className="status-badge" style={{ backgroundColor: info.color }}>
      {info.label}
    </span>
  );
}

function BoostIndicators({ boosts }: { boosts: Record<string, number> }) {
  const statNames: Record<string, string> = {
    atk: 'Atk',
    def: 'Def',
    spa: 'SpA',
    spd: 'SpD',
    spe: 'Spe',
    accuracy: 'Acc',
    evasion: 'Eva',
  };

  const activeBoosts = Object.entries(boosts).filter(([, v]) => v !== 0);
  if (activeBoosts.length === 0) return null;

  return (
    <div className="boost-row">
      {activeBoosts.map(([stat, value]) => (
        <span key={stat} className={`boost-badge ${value > 0 ? 'up' : 'down'}`}>
          {statNames[stat] || stat} {value > 0 ? '+' : ''}{value}
        </span>
      ))}
    </div>
  );
}

function getHpColor(percent: number): string {
  if (percent > 50) return 'green';
  if (percent > 20) return 'yellow';
  return 'red';
}

function getWeatherClass(weather: string | null): string {
  if (!weather) return '';
  const w = weather.toLowerCase();
  if (w.includes('sun') || w.includes('harsh')) return 'weather-sun';
  if (w.includes('rain') || w.includes('primordial')) return 'weather-rain';
  if (w.includes('sand')) return 'weather-sand';
  if (w.includes('hail') || w.includes('snow')) return 'weather-snow';
  return '';
}

function formatWeather(weather: string): string {
  const names: Record<string, string> = {
    SunnyDay: 'Sunny',
    RainDance: 'Rain',
    Sandstorm: 'Sandstorm',
    Hail: 'Hail',
    Snow: 'Snow',
    DesolateLand: 'Harsh Sun',
    PrimordialSea: 'Heavy Rain',
    DeltaStream: 'Strong Winds',
  };
  return names[weather] || weather;
}
