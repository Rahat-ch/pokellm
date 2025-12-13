import { MusicState } from '../hooks/useBattleMusic';
import './MusicPlayer.css';

interface MusicPlayerProps {
  state: MusicState;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
  onNext: () => void;
}

export function MusicPlayer({ state, onToggle, onVolumeChange, onNext }: MusicPlayerProps) {
  return (
    <div className="music-player">
      <div className="music-header">
        <span className="music-icon">🎵</span>
        <span className="music-label">Music</span>
      </div>

      <div className="music-controls">
        <button
          className={`music-btn play-btn ${state.isPlaying ? 'playing' : ''}`}
          onClick={onToggle}
          title={state.isPlaying ? 'Pause' : 'Play'}
        >
          {state.isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="music-btn skip-btn"
          onClick={onNext}
          title="Next track"
        >
          ⏭
        </button>
      </div>

      <div className="now-playing-section">
        <span className="now-playing-label">Now Playing</span>
        <span className="now-playing-track">
          {state.currentTheme?.name || 'No track'}
        </span>
      </div>

      <div className="volume-section">
        <div className="volume-header">
          <span className="volume-icon">{state.volume === 0 ? '🔇' : state.volume < 0.5 ? '🔉' : '🔊'}</span>
          <span className="volume-percent">{Math.round(state.volume * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={state.volume * 100}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          className="volume-slider"
        />
      </div>

      <div className="music-status">
        {state.isPlaying ? (
          <span className="status-playing">
            <span className="pulse-dot" />
            Playing
          </span>
        ) : (
          <span className="status-paused">Paused</span>
        )}
      </div>
    </div>
  );
}
