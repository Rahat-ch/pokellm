import { useCallback, useRef } from 'react';
import { toSpriteId } from '../lib/pokemon';

const AUDIO_BASE = 'https://play.pokemonshowdown.com/audio';

// Preload common sound effects
const soundCache: Record<string, HTMLAudioElement> = {};

function getOrCreateAudio(url: string): HTMLAudioElement {
  if (!soundCache[url]) {
    soundCache[url] = new Audio(url);
    soundCache[url].volume = 0.5;
  }
  return soundCache[url];
}

// Preload common battle sounds
const BATTLE_SOUNDS = {
  hit: `${AUDIO_BASE}/hit.mp3`,
  supereffective: `${AUDIO_BASE}/supereffective.mp3`,
  resisted: `${AUDIO_BASE}/resisted.mp3`,
  crit: `${AUDIO_BASE}/crit.mp3`,
  faint: `${AUDIO_BASE}/faint.mp3`,
};

// Preload battle sounds on module load
Object.values(BATTLE_SOUNDS).forEach((url) => {
  getOrCreateAudio(url);
});

export function useBattleSounds() {
  const lastProcessedIndex = useRef(0);
  const isMutedRef = useRef(false);

  /**
   * Play a sound effect
   */
  const playSound = useCallback((type: keyof typeof BATTLE_SOUNDS) => {
    if (isMutedRef.current) return;

    const url = BATTLE_SOUNDS[type];
    if (!url) return;

    try {
      const audio = getOrCreateAudio(url);
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay restrictions - user hasn't interacted yet
      });
    } catch {
      // Ignore audio errors
    }
  }, []);

  /**
   * Play a Pokemon's cry
   */
  const playCry = useCallback((species: string) => {
    if (isMutedRef.current) return;

    const spriteId = toSpriteId(species);
    const url = `${AUDIO_BASE}/cries/${spriteId}.mp3`;

    try {
      const audio = new Audio(url);
      audio.volume = 0.4;
      audio.play().catch(() => {
        // Cry might not exist for this Pokemon, or autoplay blocked
      });
    } catch {
      // Ignore audio errors
    }
  }, []);

  /**
   * Set mute state
   */
  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  /**
   * Process battle log and play appropriate sounds
   */
  const processBattleLog = useCallback(
    (log: string[]) => {
      const newEntries = log.slice(lastProcessedIndex.current);
      lastProcessedIndex.current = log.length;

      for (const line of newEntries) {
        const parts = line.split('|');
        const cmd = parts[1];

        switch (cmd) {
          case 'switch':
          case 'drag': {
            // Play cry on switch-in
            // |switch|p1a: Pikachu|Pikachu, L84|100/100
            const details = parts[3];
            if (details) {
              const species = details.split(',')[0];
              playCry(species);
            }
            break;
          }

          case '-damage': {
            // Play hit sound on damage
            playSound('hit');
            break;
          }

          case '-supereffective': {
            playSound('supereffective');
            break;
          }

          case '-resisted': {
            playSound('resisted');
            break;
          }

          case '-crit': {
            playSound('crit');
            break;
          }

          case 'faint': {
            playSound('faint');
            break;
          }
        }
      }
    },
    [playCry, playSound]
  );

  /**
   * Reset the processed index (useful when battle restarts)
   */
  const resetProcessedIndex = useCallback(() => {
    lastProcessedIndex.current = 0;
  }, []);

  return {
    playSound,
    playCry,
    setMuted,
    processBattleLog,
    resetProcessedIndex,
  };
}
