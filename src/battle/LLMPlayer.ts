import { createRequire } from 'module';
import { BattleFormatter } from './BattleFormatter.js';
import { ResponseParser } from '../llm/ResponseParser.js';
import type { LLMAdapter, BattleContext } from '../llm/types.js';
import { config } from '../config.js';

// Use createRequire to import CommonJS module properly
const require = createRequire(import.meta.url);
const { BattlePlayer } = require('pokemon-showdown/dist/sim/battle-stream');

export interface LLMPlayerOptions {
  adapter: LLMAdapter;
  format: string;
  slot: 'p1' | 'p2';
  onThinking?: () => void;
  onDecision?: (choice: string, reasoning?: string, decisionTime?: number) => void;
  onError?: (error: Error) => void;
}

/**
 * LLMPlayer extends BattlePlayer to integrate LLM decision-making
 * into Pokemon Showdown battles.
 */
export class LLMPlayer extends BattlePlayer {
  private adapter: LLMAdapter;
  private format: string;
  private slot: 'p1' | 'p2';
  private turn = 0;
  private onThinking?: () => void;
  private onDecision?: (choice: string, reasoning?: string, decisionTime?: number) => void;
  private onError?: (error: Error) => void;

  constructor(
    playerStream: any,
    options: LLMPlayerOptions
  ) {
    super(playerStream, false);
    this.adapter = options.adapter;
    this.format = options.format;
    this.slot = options.slot;
    this.onThinking = options.onThinking;
    this.onDecision = options.onDecision;
    this.onError = options.onError;
  }

  receiveError(error: Error) {
    // If we made an unavailable choice, we'll get a new request
    if (error.message.startsWith('[Unavailable choice]')) {
      console.log(`[${this.slot}] Unavailable choice, waiting for new request...`);
      return;
    }

    if (this.onError) {
      this.onError(error);
    } else {
      console.error(`[${this.slot}] Error:`, error.message);
    }
  }

  async receiveRequest(request: any): Promise<void> {
    if (request.wait) {
      // Waiting for opponent
      return;
    }

    // Track turn number
    if (request.active || request.forceSwitch) {
      this.turn++;
    }

    const startTime = Date.now();

    // Notify that we're thinking
    if (this.onThinking) {
      this.onThinking();
    }

    let choice: string;
    let reasoning: string | undefined;
    let usedFallback = false;

    try {
      // Format the battle state for the LLM
      let prompt: string;
      if (request.teamPreview) {
        prompt = BattleFormatter.formatTeamPreview(request);
      } else if (request.forceSwitch) {
        prompt = BattleFormatter.formatForceSwitch(request, (this as any).log, this.turn);
      } else {
        prompt = BattleFormatter.formatRequest(request, (this as any).log, this.turn);
      }

      console.log(`[${this.slot}] Turn ${this.turn} - Asking LLM for decision...`);

      // Create battle context for LLM
      const context: BattleContext = {
        turn: this.turn,
        request,
        battleLog: (this as any).log,
        format: this.format,
      };

      // Get LLM decision with timeout
      const response = await Promise.race([
        this.adapter.decide(context),
        this.timeout(config.battle.llmTimeout),
      ]);

      if (!response) {
        throw new Error('LLM timeout');
      }

      // Parse the response
      const parsed = ResponseParser.parse(response.text, request);
      reasoning = response.reasoning;

      if (parsed) {
        choice = parsed;
        console.log(`[${this.slot}] LLM chose: ${choice}`);
      } else {
        // Fallback to random valid choice
        console.log(`[${this.slot}] Failed to parse LLM response, using fallback`);
        choice = ResponseParser.getRandomValidChoice(request);
        usedFallback = true;
      }
    } catch (error) {
      console.error(`[${this.slot}] LLM error:`, error);
      choice = ResponseParser.getRandomValidChoice(request);
      usedFallback = true;
    }

    const decisionTime = Date.now() - startTime;

    // Notify about the decision
    if (this.onDecision) {
      this.onDecision(choice, reasoning, decisionTime);
    }

    console.log(`[${this.slot}] Submitting choice: ${choice} (${decisionTime}ms${usedFallback ? ', fallback' : ''})`);

    // Submit the choice
    (this as any).choose(choice);
  }

  private timeout(ms: number): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    });
  }

  getTurn(): number {
    return this.turn;
  }
}
