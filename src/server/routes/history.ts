import type { FastifyPluginAsync } from 'fastify';
import { getBattleHistory, getBattleById } from '../../db/client.js';

interface HistoryQuerystring {
  limit?: number;
  offset?: number;
}

interface BattleParams {
  id: string;
}

export const historyRoutes: FastifyPluginAsync = async (app) => {
  // Get paginated battle history
  app.get<{ Querystring: HistoryQuerystring }>('/', async (request) => {
    const limit = Math.min(request.query.limit || 20, 100);
    const offset = request.query.offset || 0;

    try {
      const result = await getBattleHistory(limit, offset);

      return {
        battles: result.battles,
        total: result.total,
        limit,
        offset,
        hasMore: offset + result.battles.length < result.total,
      };
    } catch (error) {
      console.error('History query error:', error);
      return { battles: [], total: 0, limit, offset, hasMore: false };
    }
  });

  // Get a single battle by ID
  app.get<{ Params: BattleParams }>('/:id', async (request, reply) => {
    try {
      const battle = await getBattleById(request.params.id);

      if (!battle) {
        return reply.status(404).send({ error: 'Battle not found' });
      }

      return { battle };
    } catch (error) {
      console.error('Battle lookup error:', error);
      return reply.status(404).send({ error: 'Battle not found' });
    }
  });
};
