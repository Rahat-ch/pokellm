import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export interface BattleStartedPayload {
  battleId: string;
  p1: { provider: string; model: string };
  p2: { provider: string; model: string };
  format: string;
  initialLog?: string[];  // Initial protocol chunks with Pokemon data
}

export interface BattleUpdatePayload {
  battleId: string;
  chunk: string;
}

export interface BattleThinkingPayload {
  battleId: string;
  player: 'p1' | 'p2';
  startTime: number;
}

export interface BattleReasoningPayload {
  battleId: string;
  player: 'p1' | 'p2';
  chunk: string;
  done: boolean;
}

export interface BattleDecisionPayload {
  battleId: string;
  player: 'p1' | 'p2';
  choice: string;
  reasoning?: string;
  time: number;
}

export interface BattleEndPayload {
  battleId: string;
  winner: string | null;
  p1: { provider: string; model: string };
  p2: { provider: string; model: string };
}

export interface BattleStatusPayload {
  active: boolean;
  battleId?: string;
  turn?: number;
  p1?: { provider: string; model: string };
  p2?: { provider: string; model: string };
  winner?: string | null;
  spectatorCount?: number;
  battleLog?: string[];  // Protocol history for late joiners
}

/**
 * Initialize Socket.io server and attach to HTTP server
 */
export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Send current battle status on connect
    socket.emit('battle:status', getCurrentBattleStatus());

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });

    // Client can request current status
    socket.on('battle:getStatus', () => {
      socket.emit('battle:status', getCurrentBattleStatus());
    });
  });

  console.log('[Socket] Socket.io server initialized');
  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Get current spectator count
 */
export function getSpectatorCount(): number {
  if (!io) return 0;
  return io.engine.clientsCount;
}

/**
 * Placeholder for getting current battle status
 * This will be replaced with actual BattleManager integration
 */
let battleStatusGetter: (() => BattleStatusPayload) | null = null;

export function setBattleStatusGetter(getter: () => BattleStatusPayload): void {
  battleStatusGetter = getter;
}

function getCurrentBattleStatus(): BattleStatusPayload {
  if (battleStatusGetter) {
    const status = battleStatusGetter();
    return {
      ...status,
      spectatorCount: getSpectatorCount(),
    };
  }
  return { active: false, spectatorCount: getSpectatorCount() };
}

// Broadcast helper functions
export function emitBattleStarted(payload: BattleStartedPayload): void {
  io?.emit('battle:started', payload);
}

export function emitBattleUpdate(payload: BattleUpdatePayload): void {
  io?.emit('battle:update', payload);
}

export function emitBattleThinking(payload: BattleThinkingPayload): void {
  io?.emit('battle:thinking', payload);
}

export function emitBattleReasoning(payload: BattleReasoningPayload): void {
  io?.emit('battle:reasoning', payload);
}

export function emitBattleDecision(payload: BattleDecisionPayload): void {
  io?.emit('battle:decision', payload);
}

export function emitBattleEnd(payload: BattleEndPayload): void {
  io?.emit('battle:end', payload);
}

export function emitBattleStatus(payload: BattleStatusPayload): void {
  io?.emit('battle:status', {
    ...payload,
    spectatorCount: getSpectatorCount(),
  });
}
