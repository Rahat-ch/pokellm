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

const STREAMING_SYSTEM_PROMPT = `You are an expert Pokemon battle AI competing in a Pokemon battle. THINK OUT LOUD as you analyze the situation.

RESPONSE FORMAT:
1. First, briefly analyze the current situation (type matchups, HP, threats)
2. Consider 2-3 options and their pros/cons
3. Make your final decision
4. End with EXACTLY one of these on its own line:
   - ACTION: move N (where N is 1-4)
   - ACTION: switch N (where N is 2-6)
   - ACTION: default (only for team preview)

Example response:
"My Charizard (Fire/Flying) is facing their Blastoise (Water). I'm at a type disadvantage here.

Options:
1. Switch to Venusaur - resists Water, can threaten with Grass moves
2. Use Solar Beam - super effective but risky if they switch
3. Stay and use Air Slash - neutral damage, might flinch

Given their HP advantage, switching is safest to preserve Charizard.

ACTION: switch 3"

Be strategic and explain your reasoning clearly.`;

export class OpenAIAdapter implements LLMAdapter {
  provider = 'openai' as const;
  model: string;
  private client: OpenAI;
  private temperature: number;
  private apiKey: string;

  constructor(model: string, temperature = 0.7) {
    this.model = model;
    this.temperature = temperature;

    if (!config.llm.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    this.apiKey = config.llm.openai.apiKey;
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  private isResponsesApiModel(): boolean {
    return this.model.startsWith('gpt-5');
  }

  private formatPrompt(context: BattleContext): string {
    if (context.request.teamPreview) {
      return BattleFormatter.formatTeamPreview(context.request);
    } else if (context.request.forceSwitch) {
      return BattleFormatter.formatForceSwitch(context.request, context.battleLog, context.turn);
    } else {
      return BattleFormatter.formatRequest(context.request, context.battleLog, context.turn);
    }
  }

  private async decideWithResponsesApi(context: BattleContext): Promise<LLMResponse> {
    const prompt = this.formatPrompt(context);

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        instructions: SYSTEM_PROMPT,
        input: prompt,
        max_output_tokens: 200,
        temperature: this.temperature
      })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Responses API error: ${res.status} ${error}`);
    }

    const data = await res.json() as {
      output?: Array<{ text?: string; content?: string }>;
      usage?: { total_tokens?: number };
    };
    const text = data.output?.[0]?.text || data.output?.[0]?.content || '';

    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      text: command,
      reasoning,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  private async decideWithResponsesApiStreaming(
    context: BattleContext,
    _onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    // GPT-5.2 doesn't expose reasoning in stream, so just use non-streaming
    return this.decideWithResponsesApi(context);
  }

  async decide(context: BattleContext): Promise<LLMResponse> {
    if (this.isResponsesApiModel()) {
      return this.decideWithResponsesApi(context);
    }

    const prompt = this.formatPrompt(context);

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

    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      text: command,
      reasoning,
      tokensUsed: response.usage?.total_tokens,
    };
  }

  async decideWithStreaming(
    context: BattleContext,
    _onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    // No streaming - just return final result
    return this.decide(context);
  }

  destroy(): void {
    // No cleanup needed for OpenAI client
  }
}
