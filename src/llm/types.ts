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

export type DialogueEventType =
  | 'battle_start'
  | 'own_faint'
  | 'opponent_faint'
  | 'super_effective'
  | 'critical_hit'
  | 'win'
  | 'loss'
  | 'trash_talk';

export interface DialogueContext {
  type: DialogueEventType;
  opponent: { provider: string; model: string };
  ownPokemon?: string;
  opponentPokemon?: string;
  moveName?: string;
  turn: number;
  ownHpPercent?: number;
  opponentHpPercent?: number;
  ownTeamRemaining?: number;
  opponentTeamRemaining?: number;
}
