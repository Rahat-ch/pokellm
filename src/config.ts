import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://pokellm:password@localhost:5432/pokellm',
  },

  llm: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
    },
    xai: {
      apiKey: process.env.XAI_API_KEY || '',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    },
  },

  battle: {
    format: 'gen9randombattle',
    llmTimeout: 30000, // 30 seconds timeout for LLM responses
  },
};
