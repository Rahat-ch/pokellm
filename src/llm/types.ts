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
  destroy(): void;
}
