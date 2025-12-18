import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
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

export class GeminiAdapter implements LLMAdapter {
  provider = 'google' as const;
  model: string;
  private client: GoogleGenerativeAI | null = null;
  private newClient: GoogleGenAI | null = null;
  private temperature: number;

  constructor(model: string, temperature = 0.7) {
    this.model = model;
    this.temperature = temperature;

    if (!config.llm.google.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }

    if (this.isGemini3Model()) {
      this.newClient = new GoogleGenAI({ apiKey: config.llm.google.apiKey });
    } else {
      this.client = new GoogleGenerativeAI(config.llm.google.apiKey);
    }
  }

  private isGemini3Model(): boolean {
    return this.model.startsWith('gemini-3');
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

    if (this.isGemini3Model()) {
      return this.decideWithNewSdk(prompt);
    }

    const generativeModel = this.client!.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: 150,
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Try to extract reasoning (anything after the command)
    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    // Gemini doesn't provide token counts in the same way
    const tokensUsed = response.usageMetadata?.totalTokenCount;

    return {
      text: command,
      reasoning,
      tokensUsed,
    };
  }

  private async decideWithNewSdk(prompt: string): Promise<LLMResponse> {
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;
    const response = await this.newClient!.models.generateContent({
      model: this.model,
      contents: fullPrompt,
    });

    const text = response.text || '';
    const lines = text.trim().split('\n');
    const command = lines[0];
    const reasoning = lines.slice(1).join('\n').trim() || undefined;

    return {
      text: command,
      reasoning,
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
    // No cleanup needed for Gemini client
  }
}
