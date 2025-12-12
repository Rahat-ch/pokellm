import type { LLMAdapter, LLMConfig } from './types.js';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js';
import { GeminiAdapter } from './adapters/GeminiAdapter.js';
import { GrokAdapter } from './adapters/GrokAdapter.js';
import { DeepSeekAdapter } from './adapters/DeepSeekAdapter.js';

/**
 * Factory to create LLM adapters based on provider configuration
 */
export class AdapterFactory {
  static create(llmConfig: LLMConfig): LLMAdapter {
    switch (llmConfig.provider) {
      case 'claude':
        return new ClaudeAdapter(llmConfig.model, llmConfig.temperature);

      case 'openai':
        return new OpenAIAdapter(llmConfig.model, llmConfig.temperature);

      case 'google':
        return new GeminiAdapter(llmConfig.model, llmConfig.temperature);

      case 'xai':
        return new GrokAdapter(llmConfig.model, llmConfig.temperature);

      case 'deepseek':
        return new DeepSeekAdapter(llmConfig.model, llmConfig.temperature);

      default:
        throw new Error(`Unknown LLM provider: ${llmConfig.provider}`);
    }
  }

  /**
   * Check if a provider is available (API key configured)
   */
  static isAvailable(provider: string): boolean {
    switch (provider) {
      case 'claude':
        return !!process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return !!process.env.OPENAI_API_KEY;
      case 'google':
        return !!process.env.GOOGLE_AI_API_KEY;
      case 'xai':
        return !!process.env.XAI_API_KEY;
      case 'deepseek':
        return !!process.env.DEEPSEEK_API_KEY;
      default:
        return false;
    }
  }

  /**
   * Get list of available providers
   */
  static getAvailableProviders(): string[] {
    const providers = ['claude', 'openai', 'google', 'xai', 'deepseek'];
    return providers.filter((p) => this.isAvailable(p));
  }

  /**
   * Get default model for a provider
   */
  static getDefaultModel(provider: string): string {
    switch (provider) {
      case 'claude':
        return 'claude-sonnet-4-20250514';
      case 'openai':
        return 'gpt-4o';
      case 'google':
        return 'gemini-1.5-flash';
      case 'xai':
        return 'grok-2-latest';
      case 'deepseek':
        return 'deepseek-chat';
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
