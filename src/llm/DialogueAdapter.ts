import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { LLMProvider, DialogueContext, DialogueEventType } from './types.js';

const DIALOGUE_PROMPTS: Record<DialogueEventType, string> = {
  battle_start: `You're a Pokemon trainer about to battle {opponent}. Give a short, cocky trash talk intro. Be playful and competitive. 1-2 sentences max. Just the dialogue, no quotes.`,

  own_faint: `Your {ownPokemon} just fainted in battle against {opponent}. React with brief sorrow or frustration. 1 sentence max. Just the dialogue.`,

  opponent_faint: `Your attack just knocked out {opponent}'s {opponentPokemon}! Brief celebration or taunt. 1 sentence max. Just the dialogue.`,

  super_effective: `Your {moveName} was super effective against {opponent}'s Pokemon! Quick excited reaction. A few words only. Just the dialogue.`,

  critical_hit: `You just landed a critical hit! Quick excited exclamation. A few words only. Just the dialogue.`,

  win: `You just won the Pokemon battle against {opponent}! Give a victory speech. Be gracious but confident. 1-2 sentences. Just the dialogue.`,

  loss: `You just lost to {opponent}. Brief, graceful defeat acknowledgment. 1 sentence. Just the dialogue.`,

  trash_talk: `Mid-battle taunt to {opponent}. {context} Be playful and competitive. 1 sentence. Just the dialogue.`,
};

const GROK_DIALOGUE_PROMPTS: Record<DialogueEventType, string> = {
  battle_start: `You're about to battle {opponent}. Roast them hard - be savage, witty, and ruthless. Channel your inner trash-talker. 1-2 sentences. Just the dialogue.`,

  own_faint: `Your {ownPokemon} just got wrecked by {opponent}. React with dramatic frustration or dark humor. 1 sentence. Just the dialogue.`,

  opponent_faint: `You just destroyed {opponent}'s {opponentPokemon}! Savage celebration - rub it in their face. 1 sentence. Just the dialogue.`,

  super_effective: `Your {moveName} absolutely demolished them! Quick savage reaction. Just the dialogue.`,

  critical_hit: `CRITICAL HIT! Brutal exclamation. Just the dialogue.`,

  win: `You crushed {opponent}! Victory roast - be merciless but clever. 1-2 sentences. Just the dialogue.`,

  loss: `{opponent} beat you. Salty but funny defeat reaction. 1 sentence. Just the dialogue.`,

  trash_talk: `Mid-battle roast to {opponent}. {context} Be absolutely savage. 1 sentence. Just the dialogue.`,
};

export class DialogueAdapter {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async generateDialogue(context: DialogueContext): Promise<string> {
    const prompt = this.buildPrompt(context);

    try {
      switch (this.provider) {
        case 'openai':
          return await this.callOpenAI(prompt);
        case 'claude':
          return await this.callClaude(prompt);
        case 'google':
          return await this.callGemini(prompt);
        case 'xai':
          return await this.callGrok(prompt);
        case 'deepseek':
          return await this.callDeepSeek(prompt);
        default:
          return this.getFallbackDialogue(context.type);
      }
    } catch (error) {
      console.error(`[DialogueAdapter] Error generating dialogue:`, error);
      return this.getFallbackDialogue(context.type);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const client = new OpenAI({ apiKey: config.llm.openai.apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() || '';
  }

  private async callClaude(prompt: string): Promise<string> {
    const client = new Anthropic({ apiKey: config.llm.anthropic.apiKey });
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return text.trim();
  }

  private async callGemini(prompt: string): Promise<string> {
    const client = new GoogleGenerativeAI(config.llm.google.apiKey!);
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  private async callGrok(prompt: string): Promise<string> {
    const client = new OpenAI({
      apiKey: config.llm.xai.apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
    const response = await client.chat.completions.create({
      model: 'grok-3-fast',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() || '';
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    const client = new OpenAI({
      apiKey: config.llm.deepseek.apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0]?.message?.content?.trim() || '';
  }

  private buildPrompt(context: DialogueContext): string {
    const prompts = this.provider === 'xai' ? GROK_DIALOGUE_PROMPTS : DIALOGUE_PROMPTS;
    let prompt = prompts[context.type];

    const opponentName = `${context.opponent.provider}/${context.opponent.model}`;
    prompt = prompt.replace('{opponent}', opponentName);

    if (context.ownPokemon) {
      prompt = prompt.replace('{ownPokemon}', context.ownPokemon);
    }
    if (context.opponentPokemon) {
      prompt = prompt.replace('{opponentPokemon}', context.opponentPokemon);
    }
    if (context.moveName) {
      prompt = prompt.replace('{moveName}', context.moveName);
    }

    if (context.type === 'trash_talk') {
      const contextParts = [];
      if (context.ownHpPercent !== undefined && context.opponentHpPercent !== undefined) {
        if (context.ownHpPercent > context.opponentHpPercent + 20) {
          contextParts.push("You're winning - their Pokemon looks weak.");
        } else if (context.opponentHpPercent > context.ownHpPercent + 20) {
          contextParts.push("You're behind but staying confident.");
        }
      }
      if (context.turn > 15) {
        contextParts.push(`It's turn ${context.turn}, this battle is dragging on.`);
      }
      prompt = prompt.replace('{context}', contextParts.join(' ') || 'Keep it general.');
    }

    return prompt;
  }

  private getFallbackDialogue(type: DialogueEventType): string {
    const fallbacks: Record<DialogueEventType, string> = {
      battle_start: "Let's do this!",
      own_faint: "No! Come back!",
      opponent_faint: "Yes! Great work!",
      super_effective: "Super effective!",
      critical_hit: "Critical hit!",
      win: "Victory is mine!",
      loss: "Good battle...",
      trash_talk: "You can't beat me!",
    };
    return fallbacks[type];
  }

  destroy(): void {
    // No cleanup needed
  }
}
