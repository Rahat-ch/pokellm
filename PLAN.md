# PokeLLM Implementation Plan

LLM vs LLM Pokemon Battle Web App with real-time spectating.

## Requirements
- **Frontend**: Next.js (in `frontend/` folder, same repo)
- **Real-time**: WebSocket with streaming LLM reasoning
- **Single battle**: Block new battles while one is in progress
- **Scoreboard**: Track wins/losses per model
- **History**: Battle summaries
- **Format**: gen9randombattle
- **Streaming**: All 5 LLM adapters (Claude, OpenAI, Gemini, Grok, DeepSeek)
- **Database**: PostgreSQL with Docker setup

## Current State (pokellm)
- Fastify REST API working
- BattleManager with EventEmitter (`thinking`, `decision`, `update`, `end` events)
- LLM adapters: Claude, OpenAI, Gemini, Grok, DeepSeek
- Socket.io installed but NOT integrated
- PostgreSQL configured but NOT used

---

## Phase 1: WebSocket Integration

### 1.1 Create Socket.io Server
**Create**: `src/server/socket.ts`
- Initialize Socket.io server
- Define events: `battle:started`, `battle:update`, `battle:thinking`, `battle:reasoning`, `battle:decision`, `battle:end`, `battle:status`
- Handle client connections/disconnections
- Export `io` instance for BattleManager

### 1.2 Integrate with Fastify
**Modify**: `src/server/app.ts`
- Import and attach Socket.io to Fastify's HTTP server
- Pass `io` instance to battle routes/manager

### 1.3 Wire BattleManager to Socket.io
**Modify**: `src/battle/BattleManager.ts`
- Forward existing EventEmitter events to Socket.io broadcasts
- Add spectator count tracking
- Emit `battle:status` on connect

---

## Phase 2: LLM Streaming Reasoning

### 2.1 Update Types
**Modify**: `src/llm/types.ts`
```typescript
interface LLMAdapter {
  // existing...
  decideWithStreaming?(
    context: BattleContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse>;
}
```

### 2.2 Claude Streaming
**Modify**: `src/llm/adapters/ClaudeAdapter.ts`
- Add `decideWithStreaming()` using `client.messages.stream()`
- Update system prompt to encourage verbose reasoning
- Stream chunks via callback

### 2.3 OpenAI Streaming
**Modify**: `src/llm/adapters/OpenAIAdapter.ts`
- Add `decideWithStreaming()` using `stream: true`

### 2.4 Gemini Streaming
**Modify**: `src/llm/adapters/GeminiAdapter.ts`
- Add `decideWithStreaming()` using `generateContentStream()`

### 2.5 Grok Streaming
**Modify**: `src/llm/adapters/GrokAdapter.ts`
- Add `decideWithStreaming()` (uses OpenAI-compatible API with `stream: true`)

### 2.6 DeepSeek Streaming
**Modify**: `src/llm/adapters/DeepSeekAdapter.ts`
- Add `decideWithStreaming()` (uses OpenAI-compatible API with `stream: true`)

### 2.7 Wire to LLMPlayer
**Modify**: `src/battle/LLMPlayer.ts`
- Add `onReasoningChunk` callback to options
- Use streaming when available
- Emit chunks to Socket.io via BattleManager

---

## Phase 3: Database

### 3.0 Docker Setup
**Create**: `docker-compose.yml`
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: pokellm
      POSTGRES_USER: pokellm
      POSTGRES_PASSWORD: pokellm
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```
- Run with `docker-compose up -d`
- Update `.env` with connection string

### 3.1 Schema
**Create**: `src/db/schema.sql`
```sql
CREATE TABLE battles (
  id UUID PRIMARY KEY,
  battle_id VARCHAR(100) UNIQUE,
  format VARCHAR(50),
  p1_provider VARCHAR(50),
  p1_model VARCHAR(100),
  p2_provider VARCHAR(50),
  p2_model VARCHAR(100),
  winner_side VARCHAR(10),
  total_turns INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  battle_log JSONB
);

CREATE MATERIALIZED VIEW scoreboard AS
-- aggregates wins/losses/win_rate per provider+model
```

### 3.2 Database Client
**Create**: `src/db/client.ts`
- `saveBattle()`, `getBattleHistory()`, `getScoreboard()`, `refreshScoreboard()`

### 3.3 Save on Battle End
**Modify**: `src/battle/BattleManager.ts`
- On `end` event, persist to database

---

## Phase 4: API Enhancements

### 4.1 New Routes
**Create**: `src/server/routes/scoreboard.ts`
- `GET /api/scoreboard` - leaderboard

**Create**: `src/server/routes/history.ts`
- `GET /api/history` - paginated battle list
- `GET /api/history/:id` - single battle details

**Modify**: `src/server/routes/battle.ts`
- `GET /api/providers` - available LLM providers/models

---

## Phase 5: Next.js Frontend

### 5.1 Project Setup
**Create**: `frontend/` (Next.js app in same repo)
```
frontend/
├── app/
│   ├── page.tsx              # Home - start battle
│   ├── battle/page.tsx       # Live spectator view
│   ├── history/page.tsx      # Battle history
│   └── scoreboard/page.tsx   # Leaderboard
├── components/
│   ├── BattleArena.tsx       # Pokemon cards, HP bars
│   ├── ReasoningPanel.tsx    # Streaming LLM thoughts
│   ├── MoveLog.tsx           # Battle event log
│   └── LLMSelector.tsx       # Provider/model picker
├── hooks/
│   ├── useSocket.ts          # Socket.io connection
│   └── useBattle.ts          # Battle state
└── lib/
    └── api.ts                # REST API client
```
- Initialize with `npx create-next-app@latest frontend`
- Install `socket.io-client`

### 5.2 Home Page
- Two LLM selectors (p1, p2)
- "Start Battle" button
- If battle in progress: "Battle in Progress - Watch" link

### 5.3 Battle Page
- Pokemon cards (sprites, HP bars, status)
- Reasoning panels (p1 left, p2 right) with streaming text
- Move log (scrolling battle events)
- Turn counter, thinking indicators

### 5.4 History & Scoreboard
- Table of past battles with winner
- Leaderboard sorted by wins/win rate

---

## File Summary

### Create
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local dev (PostgreSQL) |
| `Dockerfile` | Production build (Coolify) |
| `src/server/socket.ts` | Socket.io server |
| `src/db/schema.sql` | PostgreSQL schema |
| `src/db/client.ts` | Database queries |
| `src/server/routes/scoreboard.ts` | Scoreboard API |
| `src/server/routes/history.ts` | History API |
| `frontend/*` | Next.js app |

### Modify
| File | Changes |
|------|---------|
| `src/server/app.ts` | Attach Socket.io |
| `src/battle/BattleManager.ts` | Socket events, DB persistence |
| `src/battle/LLMPlayer.ts` | Streaming callback |
| `src/llm/types.ts` | `decideWithStreaming` interface |
| `src/llm/adapters/ClaudeAdapter.ts` | Streaming support |
| `src/llm/adapters/OpenAIAdapter.ts` | Streaming support |
| `src/llm/adapters/GeminiAdapter.ts` | Streaming support |
| `src/llm/adapters/GrokAdapter.ts` | Streaming support |
| `src/llm/adapters/DeepSeekAdapter.ts` | Streaming support |
| `frontend/next.config.js` | Static export for production |

---

## Phase 6: Deployment (Coolify/Hetzner)

### 6.1 Dockerfile
**Create**: `Dockerfile`
- Multi-stage build: build frontend, then bundle with backend
- Fastify serves Next.js static export via `@fastify/static`
- Single container for simplicity

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend + bundle
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY --from=frontend-build /app/frontend/out ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 6.2 Next.js Static Export
**Modify**: `frontend/next.config.js`
- Set `output: 'export'` for static build
- Fastify serves from `/public`

### 6.3 Coolify Setup
- Deploy as Docker container
- Add PostgreSQL service in Coolify
- Set environment variables (API keys, DATABASE_URL)
- Domain: `pokellm.rahatcodes.com` via Cloudflare

### 6.4 CORS & WebSocket
- Same-origin deployment = no CORS issues
- WebSocket connects to same host

---

## Implementation Order

1. **Phase 1**: Socket.io integration (foundation for real-time)
2. **Phase 2**: LLM streaming (core feature)
3. **Phase 3**: Database (persistence)
4. **Phase 4**: API enhancements
5. **Phase 5**: Next.js frontend
6. **Phase 6**: Deployment (Dockerfile + Coolify)
