import Anthropic from '@anthropic-ai/sdk';
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

export class ClaudeAdapter implements LLMAdapter {
  provider = 'claude' as const;
  model: string;
  private client: Anthropic;
  private temperature: number;

  constructor(model: string, temperature = 0.7) {
    this.model = model;
    this.temperature = temperature;

    if (!config.llm.anthropic.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    this.client = new Anthropic({
      apiKey: config.llm.anthropic.apiKey,
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

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 150,
      temperature: this.temperature,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Try to extract reasoning (anything after the command)
    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      text: command,
      reasoning,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  async decideWithStreaming(
    context: BattleContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Format the battle state
    let prompt: string;
    if (context.request.teamPreview) {
      prompt = BattleFormatter.formatTeamPreview(context.request);
    } else if (context.request.forceSwitch) {
      prompt = BattleFormatter.formatForceSwitch(context.request, context.battleLog, context.turn);
    } else {
      prompt = BattleFormatter.formatRequest(context.request, context.battleLog, context.turn);
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 500, // More tokens for verbose reasoning
      temperature: this.temperature,
      system: STREAMING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let fullText = '';
    let tokensUsed = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          fullText += delta.text;
          onChunk(delta.text);
        }
      } else if (event.type === 'message_delta') {
        const usage = (event as any).usage;
        if (usage) {
          tokensUsed = (usage.input_tokens || 0) + (usage.output_tokens || 0);
        }
      }
    }

    // Parse the ACTION from the response
    const actionMatch = fullText.match(/ACTION:\s*(move|switch|default)\s*(\d*)/i);
    let command: string;

    if (actionMatch) {
      const action = actionMatch[1].toLowerCase();
      const num = actionMatch[2];
      command = num ? `${action} ${num}` : action;
    } else {
      // Fallback: try to find move/switch pattern
      const fallbackMatch = fullText.match(/\b(move|switch)\s+(\d+)\b/i);
      command = fallbackMatch ? `${fallbackMatch[1].toLowerCase()} ${fallbackMatch[2]}` : 'default';
    }

    return {
      text: command,
      reasoning: fullText,
      tokensUsed,
    };
  }

  destroy(): void {
    // No cleanup needed for Anthropic client
  }
}
