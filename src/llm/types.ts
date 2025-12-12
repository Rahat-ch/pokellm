export type LLMProvider = 'claude' | 'openai' | 'google' | 'xai' | 'deepseek';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
  reasoning?: string;
  tokensUsed?: number;
}

export interface BattleContext {
  turn: number;
  request: any;
  battleLog: string[];
  format: string;
}

export interface LLMAdapter {
  provider: LLMProvider;
  model: string;
  decide(context: BattleContext): Promise<LLMResponse>;
  /**
   * Stream reasoning as it's generated, calling onChunk for each piece.
   * Returns the final response when complete.
   */
  decideWithStreaming?(
    context: BattleContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
  destroy(): void;
}
