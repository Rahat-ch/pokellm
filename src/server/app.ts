import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { battleRoutes } from './routes/battle.js';

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

  return app;
}
