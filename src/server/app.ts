import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { battleRoutes } from './routes/battle.js';
import { scoreboardRoutes } from './routes/scoreboard.js';
import { historyRoutes } from './routes/history.js';
import { initializeSocket, setBattleStatusGetter, getSpectatorCount } from './socket.js';
import { battleManager } from '../battle/BattleManager.js';

export async function buildApp() {
  const app = Fastify({
    logger: config.nodeEnv === 'development',
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
  });

  // Health check
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(battleRoutes, { prefix: '/api/battle' });
  await app.register(scoreboardRoutes, { prefix: '/api/scoreboard' });
  await app.register(historyRoutes, { prefix: '/api/history' });

  // Initialize Socket.io after app is ready
  app.addHook('onReady', async () => {
    // Get the underlying HTTP server and attach Socket.io
    const httpServer = app.server;
    initializeSocket(httpServer);

    // Set up battle status getter for socket connections
    setBattleStatusGetter(() => {
      const status = battleManager.getStatus();
      return {
        ...status,
        spectatorCount: getSpectatorCount(),
      };
    });
  });

  return app;
}
