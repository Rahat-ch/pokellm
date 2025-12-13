import { useState, useEffect, useRef } from 'react';
import { useSocket, BattleStartedEvent, BattleThinkingEvent, BattleReasoningEvent, BattleDecisionEvent, BattleUpdateEvent, BattleEndEvent } from './useSocket';
import { VisualBattleState, createInitialVisualState, updateVisualState } from '../lib/pokemon';

// How long to show move announcements (ms)
const MOVE_ANNOUNCEMENT_DURATION = 2500;

export interface PlayerState {
  provider: string;
  model: string;
  thinking: boolean;
  reasoning: string;
  lastDecision?: string;
  decisionTime?: number;
}

export interface BattleState {
  active: boolean;
  battleId?: string;
  turn: number;
  p1: PlayerState | null;
  p2: PlayerState | null;
  winner: string | null;
  log: string[];
  spectatorCount: number;
  visual: VisualBattleState;
}

const initialPlayerState = (provider: string, model: string): PlayerState => ({
  provider,
  model,
  thinking: false,
  reasoning: '',
});

export function useBattle() {
  const { connected, status, on } = useSocket();
  const p1MoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const p2MoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [battle, setBattle] = useState<BattleState>({
    active: false,
    turn: 0,
    p1: null,
    p2: null,
    winner: null,
    log: [],
    spectatorCount: 0,
    visual: createInitialVisualState(),
  });

  // Clear move announcement timeouts on unmount
  useEffect(() => {
    return () => {
      if (p1MoveTimeoutRef.current) clearTimeout(p1MoveTimeoutRef.current);
      if (p2MoveTimeoutRef.current) clearTimeout(p2MoveTimeoutRef.current);
    };
  }, []);

  // Update from initial status (for late joiners)
  useEffect(() => {
    if (status.active && status.p1 && status.p2) {
      setBattle((prev) => {
        let visual = prev.visual;

        // Replay battle log if available and visual is empty (late joiner)
        if (status.battleLog && status.battleLog.length > 0 && !prev.visual.p1Pokemon && !prev.visual.p2Pokemon) {
          visual = createInitialVisualState();
          for (const chunk of status.battleLog) {
            const lines = chunk.split('\n').filter((l) => l.startsWith('|'));
            for (const line of lines) {
              visual = updateVisualState(visual, line);
            }
          }
        }

        return {
          ...prev,
          active: true,
          battleId: status.battleId,
          turn: status.turn || 0,
          p1: prev.p1 || initialPlayerState(status.p1!.provider, status.p1!.model),
          p2: prev.p2 || initialPlayerState(status.p2!.provider, status.p2!.model),
          winner: status.winner || null,
          spectatorCount: status.spectatorCount || 0,
          visual,
        };
      });
    }
  }, [status]);

  // Battle started - process initial log if available
  useEffect(() => {
    return on<BattleStartedEvent>('battle:started', (data) => {
      // Build initial visual state from initialLog (contains switch events)
      let visual = createInitialVisualState();
      if (data.initialLog) {
        for (const chunk of data.initialLog) {
          const lines = chunk.split('\n').filter((l) => l.startsWith('|'));
          for (const line of lines) {
            visual = updateVisualState(visual, line);
          }
        }
      }

      setBattle({
        active: true,
        battleId: data.battleId,
        turn: 0,
        p1: initialPlayerState(data.p1.provider, data.p1.model),
        p2: initialPlayerState(data.p2.provider, data.p2.model),
        winner: null,
        log: [],
        spectatorCount: 0,
        visual,  // Use pre-populated visual state
      });
    });
  }, [on]);

  // Thinking indicator
  useEffect(() => {
    return on<BattleThinkingEvent>('battle:thinking', (data) => {
      setBattle((prev) => ({
        ...prev,
        [data.player]: prev[data.player]
          ? { ...prev[data.player]!, thinking: true, reasoning: '' }
          : null,
      }));
    });
  }, [on]);

  // Streaming reasoning
  useEffect(() => {
    return on<BattleReasoningEvent>('battle:reasoning', (data) => {
      if (data.done) {
        setBattle((prev) => ({
          ...prev,
          [data.player]: prev[data.player]
            ? { ...prev[data.player]!, thinking: false }
            : null,
        }));
      } else {
        setBattle((prev) => ({
          ...prev,
          [data.player]: prev[data.player]
            ? {
                ...prev[data.player]!,
                reasoning: prev[data.player]!.reasoning + data.chunk,
              }
            : null,
        }));
      }
    });
  }, [on]);

  // Decision made
  useEffect(() => {
    return on<BattleDecisionEvent>('battle:decision', (data) => {
      setBattle((prev) => ({
        ...prev,
        [data.player]: prev[data.player]
          ? {
              ...prev[data.player]!,
              thinking: false,
              lastDecision: data.choice,
              decisionTime: data.time,
            }
          : null,
      }));
    });
  }, [on]);

  // Battle updates (log + visual state)
  useEffect(() => {
    return on<BattleUpdateEvent>('battle:update', (data) => {
      const allLines = data.chunk.split('\n').filter((line) => line.startsWith('|'));

      // Filter for log display
      const logLines = allLines.filter((line) => {
        return (
          line.startsWith('|turn|') ||
          line.startsWith('|move|') ||
          line.startsWith('|switch|') ||
          line.startsWith('|-damage|') ||
          line.startsWith('|-heal|') ||
          line.startsWith('|faint|') ||
          line.startsWith('|-supereffective|') ||
          line.startsWith('|-crit|') ||
          line.startsWith('|win|')
        );
      });

      setBattle((prev) => {
        // Update visual state with all lines
        let newVisual = prev.visual;
        for (const line of allLines) {
          newVisual = updateVisualState(newVisual, line);
        }

        return {
          ...prev,
          log: logLines.length > 0 ? [...prev.log, ...logLines] : prev.log,
          turn: extractTurn(allLines) || prev.turn,
          visual: newVisual,
        };
      });

      // Auto-clear move announcements after delay (check each player separately)
      const p1Move = allLines.find((line) => line.startsWith('|move|p1'));
      const p2Move = allLines.find((line) => line.startsWith('|move|p2'));

      if (p1Move) {
        if (p1MoveTimeoutRef.current) clearTimeout(p1MoveTimeoutRef.current);
        p1MoveTimeoutRef.current = setTimeout(() => {
          setBattle((prev) => ({
            ...prev,
            visual: { ...prev.visual, p1LastMove: null },
          }));
        }, MOVE_ANNOUNCEMENT_DURATION);
      }

      if (p2Move) {
        if (p2MoveTimeoutRef.current) clearTimeout(p2MoveTimeoutRef.current);
        p2MoveTimeoutRef.current = setTimeout(() => {
          setBattle((prev) => ({
            ...prev,
            visual: { ...prev.visual, p2LastMove: null },
          }));
        }, MOVE_ANNOUNCEMENT_DURATION);
      }
    });
  }, [on]);

  // Battle end
  useEffect(() => {
    return on<BattleEndEvent>('battle:end', (data) => {
      setBattle((prev) => ({
        ...prev,
        active: false,
        winner: data.winner,
      }));
    });
  }, [on]);

  // Update spectator count from status
  useEffect(() => {
    return on<{ active: boolean; spectatorCount?: number }>('battle:status', (data) => {
      setBattle((prev) => ({
        ...prev,
        spectatorCount: data.spectatorCount || prev.spectatorCount,
      }));
    });
  }, [on]);

  return {
    connected,
    battle,
  };
}

function extractTurn(lines: string[]): number | null {
  for (const line of lines) {
    if (line.startsWith('|turn|')) {
      const turn = parseInt(line.split('|')[2], 10);
      if (!isNaN(turn)) return turn;
    }
  }
  return null;
}
