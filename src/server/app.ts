import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { config } from '../config.js';
import { battleRoutes } from './routes/battle.js';
import { scoreboardRoutes } from './routes/scoreboard.js';
import { historyRoutes } from './routes/history.js';
import { initializeSocket, setBattleStatusGetter, getSpectatorCount } from './socket.js';
import { battleManager } from '../battle/BattleManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Serve static frontend in production
  const publicDir = join(__dirname, '..', '..', 'public');
  if (existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
    });

    // SPA fallback - serve index.html for client-side routing
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  }

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
