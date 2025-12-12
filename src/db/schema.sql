-- PokeLLM Database Schema

-- Battles table - stores all completed battles
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id VARCHAR(100) UNIQUE NOT NULL,
  format VARCHAR(50) NOT NULL,
  p1_provider VARCHAR(50) NOT NULL,
  p1_model VARCHAR(100) NOT NULL,
  p2_provider VARCHAR(50) NOT NULL,
  p2_model VARCHAR(100) NOT NULL,
  winner_side VARCHAR(10), -- 'p1', 'p2', or NULL for tie/incomplete
  winner_provider VARCHAR(50),
  winner_model VARCHAR(100),
  total_turns INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  battle_log JSONB
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_battles_ended_at ON battles(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_winner ON battles(winner_provider, winner_model);

-- Scoreboard materialized view - aggregates wins/losses per model
CREATE MATERIALIZED VIEW IF NOT EXISTS scoreboard AS
SELECT
  provider,
  model,
  COUNT(*) FILTER (WHERE is_winner) AS wins,
  COUNT(*) FILTER (WHERE NOT is_winner) AS losses,
  COUNT(*) AS total_battles,
  ROUND(
    COUNT(*) FILTER (WHERE is_winner)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) AS win_rate
FROM (
  -- P1 entries
  SELECT
    p1_provider AS provider,
    p1_model AS model,
    winner_side = 'p1' AS is_winner
  FROM battles
  WHERE ended_at IS NOT NULL

  UNION ALL

  -- P2 entries
  SELECT
    p2_provider AS provider,
    p2_model AS model,
    winner_side = 'p2' AS is_winner
  FROM battles
  WHERE ended_at IS NOT NULL
) AS all_participants
GROUP BY provider, model
ORDER BY wins DESC, win_rate DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_scoreboard_unique ON scoreboard(provider, model);

-- Function to refresh scoreboard (call after battle ends)
CREATE OR REPLACE FUNCTION refresh_scoreboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY scoreboard;
END;
$$ LANGUAGE plpgsql;
