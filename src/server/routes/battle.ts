import type { FastifyPluginAsync } from 'fastify';
import { battleManager } from '../../battle/BattleManager.js';
import { AdapterFactory } from '../../llm/AdapterFactory.js';
import type { LLMConfig } from '../../llm/types.js';

// Provider configurations for the frontend
const PROVIDER_INFO = {
  claude: {
    name: 'Claude',
    models: ['claude-opus-4-5-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  openai: {
    name: 'OpenAI',
    models: ['gpt-5.2', 'gpt-4o', 'gpt-4o-mini'],
  },
  google: {
    name: 'Gemini',
    models: ['gemini-3-flash-preview', 'gemini-2.0-flash', 'gemini-1.5-flash'],
  },
  xai: {
    name: 'Grok',
    models: ['grok-4-fast', 'grok-3-fast', 'grok-2-latest'],
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat'],
  },
};

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

  // Get available providers and models
  app.get('/providers', async () => {
    const available = AdapterFactory.getAvailableProviders();

    const providers = available.map((providerId) => ({
      id: providerId,
      name: PROVIDER_INFO[providerId as keyof typeof PROVIDER_INFO]?.name || providerId,
      models: PROVIDER_INFO[providerId as keyof typeof PROVIDER_INFO]?.models || [
        AdapterFactory.getDefaultModel(providerId),
      ],
      defaultModel: AdapterFactory.getDefaultModel(providerId),
    }));

    return { providers };
  });
};
