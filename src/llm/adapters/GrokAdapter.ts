import OpenAI from 'openai';
import type { LLMAdapter, LLMResponse, BattleContext } from '../types.js';
import { BattleFormatter } from '../../battle/BattleFormatter.js';
import { config } from '../../config.js';

const SYSTEM_PROMPT = `You are an expert Pokemon battle AI. You are playing a competitive Pokemon battle and must make strategic decisions.

RULES:
1. You MUST respond with ONLY one of these exact formats:
   - "move N" where N is 1-4 (to use that move)
   - "switch N" where N is 2-6 (to switch to that Pokemon)
   - "default" (only for team preview)

2. Consider:
   - Type matchups and effectiveness
   - HP remaining on both sides
   - Status conditions
   - Your opponent's likely moves
   - When to switch vs when to attack

3. Be decisive - pick the best option available.

4. Your response should be ONLY the command (e.g., "move 1" or "switch 3"), optionally followed by brief reasoning on a new line.

Example good responses:
"move 1"

"switch 3"

"move 2
Switching to resist their likely attack."`;

export class GrokAdapter implements LLMAdapter {
  provider = 'xai' as const;
  model: string;
  private client: OpenAI;
  private temperature: number;

  constructor(model: string, temperature = 0.7) {
    this.model = model;
    this.temperature = temperature;

    if (!config.llm.xai.apiKey) {
      throw new Error('XAI_API_KEY is not set');
    }

    // xAI uses OpenAI-compatible API
    this.client = new OpenAI({
      apiKey: config.llm.xai.apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
  }

  async decide(context: BattleContext): Promise<LLMResponse> {
    // Format the battle state
    let prompt: string;
    if (context.request.teamPreview) {
      prompt = BattleFormatter.formatTeamPreview(context.request);
    } else if (context.request.forceSwitch) {
      prompt = BattleFormatter.formatForceSwitch(context.request, context.battleLog, context.turn);
    } else {
      prompt = BattleFormatter.formatRequest(context.request, context.battleLog, context.turn);
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 150,
      temperature: this.temperature,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || '';

    // Try to extract reasoning (anything after the command)
    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      text: command,
      reasoning,
      tokensUsed: response.usage?.total_tokens,
    };
  }

  destroy(): void {
    // No cleanup needed
  }
}
