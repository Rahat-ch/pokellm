# CLAUDE.md

This file provides guidance to Claude Code when working with the PokeLLM codebase.

## Project Overview

PokeLLM is an LLM vs LLM Pokemon battle platform where AI models compete against each other in Pokemon Showdown battles. Users can spectate battles in real-time, see LLM reasoning as it streams, and view a scoreboard of model performance.

## Build and Development Commands

```bash
# Install dependencies
npm install

# Run development server (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Test the simulator integration
npm run test:simulator

# Test Claude adapter
npm run test:claude

# Run database migrations
npm run db:migrate

# Start PostgreSQL (local dev)
docker-compose up -d
```

## Architecture

```
src/
├── index.ts                 # Fastify server entry point
├── config.ts                # Environment configuration
├── server/
│   ├── app.ts              # Fastify app setup
│   ├── socket.ts           # Socket.io server (TODO)
│   └── routes/
│       ├── battle.ts       # Battle API endpoints
│       ├── scoreboard.ts   # Scoreboard API (TODO)
│       └── history.ts      # History API (TODO)
├── battle/
│   ├── BattleManager.ts    # Battle orchestration (singleton)
│   ├── SimulatorBridge.ts  # Pokemon Showdown wrapper
│   ├── LLMPlayer.ts        # LLM-powered battle player
│   └── BattleFormatter.ts  # Formats battle state for LLM
├── llm/
│   ├── types.ts            # LLM adapter interfaces
│   ├── AdapterFactory.ts   # Creates provider adapters
│   ├── ResponseParser.ts   # Parses LLM responses to moves
│   └── adapters/
│       ├── ClaudeAdapter.ts
│       ├── OpenAIAdapter.ts
│       ├── GeminiAdapter.ts
│       ├── GrokAdapter.ts
│       └── DeepSeekAdapter.ts
└── db/
    ├── client.ts           # Database client (TODO)
    └── schema.sql          # PostgreSQL schema (TODO)
```

## Key Concepts

### BattleManager
Singleton that manages the active battle. Only one battle can run at a time.
- Emits events: `thinking`, `decision`, `update`, `end`
- Use `battleManager.startBattle(p1Config, p2Config)` to start
- Use `battleManager.getStatus()` to check current state

### LLMPlayer
Extends Pokemon Showdown's `BattlePlayer` to integrate LLM decision-making.
- Receives battle requests from the simulator
- Formats state via `BattleFormatter`
- Queries LLM adapter for decision
- Falls back to random valid move on parse failure

### LLM Adapters
Each adapter implements the `LLMAdapter` interface:
```typescript
interface LLMAdapter {
  provider: LLMProvider;
  model: string;
  decide(context: BattleContext): Promise<LLMResponse>;
  destroy(): void;
}
```

## Code Conventions

### String Quotes
- `` ` `` - Template literals for interpolation
- `'` - Internal strings, IDs
- `"` - User-visible text

### TypeScript
- Use ES modules (`import`/`export`)
- Explicit return types on public methods
- Use `type` for object shapes, `interface` for extendable contracts

### Error Handling
- LLM timeouts: 30 seconds (configurable)
- On LLM failure: fall back to random valid move
- Log errors but don't crash battles

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=       # Claude
OPENAI_API_KEY=          # GPT models
GOOGLE_AI_API_KEY=       # Gemini
XAI_API_KEY=             # Grok
DEEPSEEK_API_KEY=        # DeepSeek

# Optional
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://pokellm:pokellm@localhost:5432/pokellm
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/battle/start` | Start a new battle |
| GET | `/api/battle/status` | Get current battle status |
| GET | `/api/battle/log` | Get battle log |
| POST | `/api/battle/end` | Force end battle |
| GET | `/api/health` | Health check |

## WebSocket Events (TODO)

| Event | Direction | Description |
|-------|-----------|-------------|
| `battle:started` | Server→Client | Battle has started |
| `battle:update` | Server→Client | Battle state update |
| `battle:thinking` | Server→Client | LLM is processing |
| `battle:reasoning` | Server→Client | Streaming LLM reasoning |
| `battle:decision` | Server→Client | Move decision made |
| `battle:end` | Server→Client | Battle concluded |

## Deployment

- **Target**: Coolify on Hetzner
- **Domain**: pokellm.rahatcodes.com (via Cloudflare)
- **Container**: Single Docker container (backend + frontend)
- **Database**: PostgreSQL managed by Coolify

See `PLAN.md` for full implementation details.
