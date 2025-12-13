import { useState, useEffect, useMemo } from 'react';
import { TeamMember, getMiniSpriteUrlsWithFallbacks } from '../lib/pokemon';
import './TeamIndicator.css';

interface TeamIndicatorProps {
  team: TeamMember[];
  side: 'player' | 'opponent';
  totalSlots?: number;
}

export function TeamIndicator({ team, side, totalSlots = 6 }: TeamIndicatorProps) {
  // Fill remaining slots with empty pokeballs
  const slots = [...team];
  while (slots.length < totalSlots) {
    slots.push({ species: '', name: '', fainted: false, active: false });
  }

  return (
    <div className={`team-indicator ${side}`}>
      {slots.map((member, i) => (
        <TeamSlot key={i} member={member} />
      ))}
    </div>
  );
}

interface TeamSlotProps {
  member: TeamMember;
}

function TeamSlot({ member }: TeamSlotProps) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const isEmpty = !member.species;

  // Get list of sprite URLs to try in order
  const spriteUrls = useMemo(
    () => (member.species ? getMiniSpriteUrlsWithFallbacks(member.species) : []),
    [member.species]
  );

  // Reset when species changes
  useEffect(() => {
    setUrlIndex(0);
    setAllFailed(false);
  }, [member.species]);

  const handleError = () => {
    if (urlIndex < spriteUrls.length - 1) {
      setUrlIndex(urlIndex + 1);
    } else {
      setAllFailed(true);
    }
  };

  const showSprite = member.species && !allFailed && spriteUrls.length > 0;

  return (
    <div
      className={`team-slot ${member.fainted ? 'fainted' : ''} ${member.active ? 'active' : ''} ${isEmpty ? 'empty' : ''}`}
      title={member.species || 'Unknown'}
    >
      {showSprite ? (
        <img
          src={spriteUrls[urlIndex]}
          alt={member.species}
          className="mini-sprite"
          onError={handleError}
        />
      ) : (
        <PokeballIcon fainted={member.fainted} empty={isEmpty} />
      )}
    </div>
  );
}

function PokeballIcon({ fainted, empty }: { fainted: boolean; empty: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`pokeball-icon ${fainted ? 'fainted' : ''} ${empty ? 'empty' : ''}`}
      width="20"
      height="20"
    >
      {/* Top half - red */}
      <path
        d="M12 2C6.48 2 2 6.48 2 12h20c0-5.52-4.48-10-10-10z"
        fill={empty ? '#555' : fainted ? '#666' : '#ff4444'}
      />
      {/* Bottom half - white */}
      <path
        d="M2 12c0 5.52 4.48 10 10 10s10-4.48 10-10H2z"
        fill={empty ? '#333' : fainted ? '#444' : '#fff'}
      />
      {/* Middle line */}
      <rect x="2" y="11" width="20" height="2" fill={empty ? '#444' : '#333'} />
      {/* Center button */}
      <circle cx="12" cy="12" r="3" fill={empty ? '#444' : '#333'} />
      <circle cx="12" cy="12" r="2" fill={empty ? '#333' : fainted ? '#555' : '#fff'} />
    </svg>
  );
}
