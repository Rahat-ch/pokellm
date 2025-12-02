import type { FastifyPluginAsync } from 'fastify';
import { battleManager } from '../../battle/BattleManager.js';
import type { LLMConfig } from '../../llm/types.js';

interface StartBattleBody {
  p1: LLMConfig;
  p2: LLMConfig;
  format?: string;
}

export const battleRoutes: FastifyPluginAsync = async (app) => {
  // Start a new battle
  app.post<{ Body: StartBattleBody }>('/start', async (request, reply) => {
    const { p1, p2, format } = request.body;

    if (!p1?.provider || !p2?.provider) {
      return reply.status(400).send({
        error: 'Both p1 and p2 must have a provider specified',
      });
    }

    try {
      const battleId = await battleManager.startBattle(p1, p2, format);
      return { battleId, status: 'started' };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in progress')) {
        return reply.status(409).send({
          error: error.message,
        });
      }
      throw error;
    }
  });

  // Get current battle status
  app.get('/status', async () => {
    return battleManager.getStatus();
  });

  // Get battle log
  app.get('/log', async () => {
    const battle = battleManager.getCurrentBattle();
    if (!battle) {
      return { log: [], active: false };
    }
    return {
      log: battle.getLog(),
      active: true,
      turn: battle.turn,
    };
  });

  // Force end current battle
  app.post('/end', async (request, reply) => {
    const battle = battleManager.getCurrentBattle();
    if (!battle) {
      return reply.status(404).send({ error: 'No active battle' });
    }

    await battle.forceEnd();
    return { status: 'ended' };
  });
};
