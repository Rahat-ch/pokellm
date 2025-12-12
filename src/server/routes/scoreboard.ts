import type { FastifyPluginAsync } from 'fastify';
import { getScoreboard } from '../../db/client.js';

export const scoreboardRoutes: FastifyPluginAsync = async (app) => {
  // Get the leaderboard
  app.get('/', async () => {
    const scoreboard = await getScoreboard();
    return { scoreboard };
  });
};
