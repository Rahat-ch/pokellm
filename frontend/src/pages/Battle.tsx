import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useBattle } from '../hooks/useBattle';
import { useAnimationState } from '../hooks/useAnimationState';
import { useBattleSounds } from '../hooks/useBattleSounds';
import { useBattleMusic } from '../hooks/useBattleMusic';
import { BattleArena } from '../components/BattleArena';
import { MusicPlayer } from '../components/MusicPlayer';

export function Battle() {
  const { connected, battle } = useBattle();
  const { p1Animation, p2Animation } = useAnimationState(battle.log);
  const { processBattleLog } = useBattleSounds();
  const music = useBattleMusic();
  const logRef = useRef<HTMLDivElement>(null);
  const p1ReasoningRef = useRef<HTMLDivElement>(null);
  const p2ReasoningRef = useRef<HTMLDivElement>(null);
  const musicStartedRef = useRef(false);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battle.log]);

  // Process battle log for sounds
  useEffect(() => {
    processBattleLog(battle.log);
  }, [battle.log, processBattleLog]);

  // Auto-scroll reasoning boxes
  useEffect(() => {
    if (p1ReasoningRef.current) {
      p1ReasoningRef.current.scrollTop = p1ReasoningRef.current.scrollHeight;
    }
  }, [battle.p1?.reasoning]);

  useEffect(() => {
    if (p2ReasoningRef.current) {
      p2ReasoningRef.current.scrollTop = p2ReasoningRef.current.scrollHeight;
    }
  }, [battle.p2?.reasoning]);

  // Start music when battle becomes active
  useEffect(() => {
    if (battle.active && !musicStartedRef.current) {
      music.startMusic();
      musicStartedRef.current = true;
    }
    // Stop music when battle ends
    if (!battle.active && battle.winner && musicStartedRef.current) {
      music.stopMusic();
      musicStartedRef.current = false;
    }
  }, [battle.active, battle.winner, music]);

  if (!battle.active && !battle.winner && !battle.p1) {
    return (
      <div className="no-battle">
        <h2>No Battle in Progress</h2>
        <p>Start a new battle from the home page to watch AI models compete!</p>
        <Link to="/" className="btn btn-primary">
          Start a Battle
        </Link>
      </div>
    );
  }

  return (
    <div className="battle-page-grid">
      {/* Left Column - Stage + Thinking */}
      <div className="battle-left">
        <div className="battle-header">
          <div className="battle-info">
            <span className="turn-counter">Turn {battle.turn}</span>
            <span className="spectator-count">
              {connected ? `${battle.spectatorCount} watching` : 'Connecting...'}
            </span>
          </div>
          {battle.active && (
            <span style={{ color: 'var(--success)' }}>Battle in Progress</span>
          )}
          {!battle.active && battle.winner && (
            <Link to="/" className="btn btn-primary">
              Start New Battle
            </Link>
          )}
        </div>

        {battle.winner && (
          <div className="winner-banner">
            <h2>Battle Complete!</h2>
            <p>Winner: {battle.winner}</p>
          </div>
        )}

        {/* Visual Battle Arena (Stage) + Music Player */}
        <div className="stage-with-music">
          <BattleArena
            p1Pokemon={battle.visual.p1Pokemon}
            p2Pokemon={battle.visual.p2Pokemon}
            p1Team={battle.visual.p1Team}
            p2Team={battle.visual.p2Team}
            field={battle.visual.field}
            p1LastMove={battle.visual.p1LastMove}
            p2LastMove={battle.visual.p2LastMove}
            p1Label={battle.p1 ? `${battle.p1.provider}/${battle.p1.model}` : 'Player 1'}
            p2Label={battle.p2 ? `${battle.p2.provider}/${battle.p2.model}` : 'Player 2'}
            p1Animation={p1Animation}
            p2Animation={p2Animation}
          />
          <MusicPlayer
            state={music}
            onToggle={music.toggleMusic}
            onVolumeChange={music.setVolume}
            onNext={music.nextTheme}
          />
        </div>

        {/* LLM Thinking Panels - Side by Side */}
        <div className="thinking-panels">
          {/* Player 1 Panel */}
          <div className="player-panel p1 card">
            <div className="player-header">
              <span className="player-name">
                {battle.p1?.provider}/{battle.p1?.model}
              </span>
              {battle.p1?.thinking && (
                <span className="thinking-indicator">
                  <span className="dot" />
                  Thinking...
                </span>
              )}
            </div>

            <div
              ref={p1ReasoningRef}
              className={`reasoning-box ${battle.p1?.thinking ? 'streaming' : ''}`}
            >
              {battle.p1?.reasoning || (
                <span style={{ color: 'var(--text-secondary)' }}>
                  Waiting for reasoning...
                </span>
              )}
            </div>

            {battle.p1?.lastDecision && (
              <div className="decision-badge">
                {battle.p1.lastDecision} ({battle.p1.decisionTime}ms)
              </div>
            )}
          </div>

          {/* Player 2 Panel */}
          <div className="player-panel p2 card">
            <div className="player-header">
              <span className="player-name">
                {battle.p2?.provider}/{battle.p2?.model}
              </span>
              {battle.p2?.thinking && (
                <span className="thinking-indicator">
                  <span className="dot" />
                  Thinking...
                </span>
              )}
            </div>

            <div
              ref={p2ReasoningRef}
              className={`reasoning-box ${battle.p2?.thinking ? 'streaming' : ''}`}
            >
              {battle.p2?.reasoning || (
                <span style={{ color: 'var(--text-secondary)' }}>
                  Waiting for reasoning...
                </span>
              )}
            </div>

            {battle.p2?.lastDecision && (
              <div className="decision-badge">
                {battle.p2.lastDecision} ({battle.p2.decisionTime}ms)
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Right Column - Logs */}
      <div className="battle-right">
        <div className="battle-log" ref={logRef}>
          <h3>Battle Log</h3>
          {battle.log.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)' }}>Waiting for battle events...</div>
          ) : (
            battle.log.map((line, i) => (
              <div key={i} className={`log-entry ${getLogClass(line)}`}>
                {formatLogLine(line)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function getLogClass(line: string): string {
  if (line.startsWith('|turn|')) return 'turn';
  if (line.startsWith('|move|')) return 'move';
  if (line.startsWith('|-damage|')) return 'damage';
  if (line.startsWith('|faint|')) return 'faint';
  if (line.startsWith('|win|')) return 'win';
  return '';
}

function formatLogLine(line: string): string {
  const parts = line.split('|').filter(Boolean);

  if (line.startsWith('|turn|')) {
    return `=== Turn ${parts[1]} ===`;
  }

  if (line.startsWith('|move|')) {
    const [, pokemon, move] = parts;
    return `${pokemon} used ${move}!`;
  }

  if (line.startsWith('|switch|')) {
    const [, pokemon, details] = parts;
    return `${pokemon} switched in! (${details})`;
  }

  if (line.startsWith('|-damage|')) {
    const [, pokemon, hp] = parts;
    return `${pokemon} took damage! (${hp})`;
  }

  if (line.startsWith('|-heal|')) {
    const [, pokemon, hp] = parts;
    return `${pokemon} healed! (${hp})`;
  }

  if (line.startsWith('|faint|')) {
    return `${parts[1]} fainted!`;
  }

  if (line.startsWith('|-supereffective|')) {
    return "It's super effective!";
  }

  if (line.startsWith('|-crit|')) {
    return 'Critical hit!';
  }

  if (line.startsWith('|win|')) {
    return `Winner: ${parts[1]}!`;
  }

  return line;
}
