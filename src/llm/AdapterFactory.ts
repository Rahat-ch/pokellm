import type { LLMAdapter, LLMConfig } from './types.js';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';

/**
 * Factory to create LLM adapters based on provider configuration
 */
export class AdapterFactory {
  static create(llmConfig: LLMConfig): LLMAdapter {
    switch (llmConfig.provider) {
      case 'claude':
        return new ClaudeAdapter(llmConfig.model, llmConfig.temperature);

      case 'openai':
        // TODO: Implement OpenAI adapter
        throw new Error('OpenAI adapter not yet implemented');

      case 'google':
        // TODO: Implement Gemini adapter
        throw new Error('Google/Gemini adapter not yet implemented');

      case 'xai':
        // TODO: Implement Grok adapter
        throw new Error('xAI/Grok adapter not yet implemented');

      case 'deepseek':
        // TODO: Implement DeepSeek adapter
        throw new Error('DeepSeek adapter not yet implemented');

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
}
