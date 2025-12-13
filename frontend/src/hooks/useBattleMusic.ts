import { useState, useCallback, useRef, useEffect } from 'react';

const AUDIO_BASE = 'https://play.pokemonshowdown.com/audio';

// Available battle themes from Pokemon Showdown
const BATTLE_THEMES = [
  { id: 'bw-rival', name: 'Black & White Rival' },
  { id: 'bw-trainer', name: 'Black & White Trainer' },
  { id: 'bw-subway', name: 'Battle Subway' },
  { id: 'dpp-rival', name: 'Diamond/Pearl Rival' },
  { id: 'dpp-trainer', name: 'Diamond/Pearl Trainer' },
  { id: 'hgss-johto-trainer', name: 'HeartGold Johto Trainer' },
  { id: 'hgss-kanto-trainer', name: 'HeartGold Kanto Trainer' },
  { id: 'oras-rival', name: 'Omega Ruby Rival' },
  { id: 'oras-trainer', name: 'Omega Ruby Trainer' },
  { id: 'sm-rival', name: 'Sun & Moon Rival' },
  { id: 'sm-trainer', name: 'Sun & Moon Trainer' },
  { id: 'xy-rival', name: 'X & Y Rival' },
  { id: 'xy-trainer', name: 'X & Y Trainer' },
  { id: 'xd-miror-b', name: 'Miror B. Theme' },
];

function getRandomTheme() {
  return BATTLE_THEMES[Math.floor(Math.random() * BATTLE_THEMES.length)];
}

export interface MusicState {
  isPlaying: boolean;
  volume: number;
  currentTheme: { id: string; name: string } | null;
}

export function useBattleMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<MusicState>({
    isPlaying: false,
    volume: 0.3,
    currentTheme: null,
  });

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * Start playing a random battle theme
   */
  const startMusic = useCallback(() => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Select random theme
    const theme = getRandomTheme();
    const url = `${AUDIO_BASE}/${theme.id}.mp3`;

    // Create new audio element
    const audio = new Audio(url);
    audio.volume = state.volume;
    audio.loop = true;

    // Handle when audio can play
    audio.addEventListener('canplaythrough', () => {
      audio.play().catch(() => {
        // Autoplay might be blocked until user interaction
      });
    });

    // Handle errors (fallback to another theme if needed)
    audio.addEventListener('error', () => {
      console.warn(`Failed to load music: ${theme.id}`);
    });

    audioRef.current = audio;

    setState((prev) => ({
      ...prev,
      isPlaying: true,
      currentTheme: theme,
    }));
  }, [state.volume]);

  /**
   * Stop the music
   */
  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setState((prev) => ({
      ...prev,
      isPlaying: false,
    }));
  }, []);

  /**
   * Toggle play/pause
   */
  const toggleMusic = useCallback(() => {
    if (!audioRef.current || !state.currentTheme) {
      // No music loaded yet, start fresh
      startMusic();
      return;
    }

    if (state.isPlaying) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current.play().catch(() => {});
      setState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentTheme, startMusic]);

  /**
   * Set volume (0-1)
   */
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }

    setState((prev) => ({
      ...prev,
      volume: clampedVolume,
    }));
  }, []);

  /**
   * Skip to next random theme
   */
  const nextTheme = useCallback(() => {
    const wasPlaying = state.isPlaying;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const theme = getRandomTheme();
    const url = `${AUDIO_BASE}/${theme.id}.mp3`;

    const audio = new Audio(url);
    audio.volume = state.volume;
    audio.loop = true;

    if (wasPlaying) {
      audio.addEventListener('canplaythrough', () => {
        audio.play().catch(() => {});
      });
    }

    audioRef.current = audio;

    setState((prev) => ({
      ...prev,
      currentTheme: theme,
      isPlaying: wasPlaying,
    }));
  }, [state.isPlaying, state.volume]);

  return {
    ...state,
    startMusic,
    stopMusic,
    toggleMusic,
    setVolume,
    nextTheme,
    availableThemes: BATTLE_THEMES,
  };
}
