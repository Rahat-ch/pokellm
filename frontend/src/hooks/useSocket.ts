import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface BattleStatus {
  active: boolean;
  battleId?: string;
  turn?: number;
  p1?: { provider: string; model: string };
  p2?: { provider: string; model: string };
  winner?: string | null;
  spectatorCount?: number;
  battleLog?: string[];  // Protocol history for late joiners
}

export interface BattleStartedEvent {
  battleId: string;
  p1: { provider: string; model: string };
  p2: { provider: string; model: string };
  format: string;
  initialLog?: string[];  // Initial protocol chunks with Pokemon data
}

export interface BattleThinkingEvent {
  battleId: string;
  player: 'p1' | 'p2';
  startTime: number;
}

export interface BattleReasoningEvent {
  battleId: string;
  player: 'p1' | 'p2';
  chunk: string;
  done: boolean;
}

export interface BattleDecisionEvent {
  battleId: string;
  player: 'p1' | 'p2';
  choice: string;
  displayChoice?: string;
  reasoning?: string;
  time: number;
}

export interface BattleUpdateEvent {
  battleId: string;
  chunk: string;
}

export interface BattleEndEvent {
  battleId: string;
  winner: string | null;
  p1: { provider: string; model: string };
  p2: { provider: string; model: string };
}

export interface BattleDialogueEvent {
  battleId: string;
  player: 'p1' | 'p2';
  text: string;
  eventType: string;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<BattleStatus>({ active: false });

  useEffect(() => {
    // Connect to the server
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('battle:status', (data: BattleStatus) => {
      setStatus(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    status,
    on,
  };
}
