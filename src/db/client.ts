import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: config.database.url,
});

export interface BattleRecord {
  id?: string;
  battle_id: string;
  format: string;
  p1_provider: string;
  p1_model: string;
  p2_provider: string;
  p2_model: string;
  winner_side: string | null;
  winner_provider: string | null;
  winner_model: string | null;
  total_turns: number;
  started_at: Date;
  ended_at: Date | null;
  battle_log?: string[];
}

export interface ScoreboardEntry {
  provider: string;
  model: string;
  wins: number;
  losses: number;
  total_battles: number;
  win_rate: number;
}

/**
 * Save a completed battle to the database
 */
export async function saveBattle(battle: BattleRecord): Promise<void> {
  const query = `
    INSERT INTO battles (
      battle_id, format, p1_provider, p1_model, p2_provider, p2_model,
      winner_side, winner_provider, winner_model, total_turns,
      started_at, ended_at, battle_log
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (battle_id) DO UPDATE SET
      winner_side = $7,
      winner_provider = $8,
      winner_model = $9,
      total_turns = $10,
      ended_at = $12,
      battle_log = $13
  `;

  await pool.query(query, [
    battle.battle_id,
    battle.format,
    battle.p1_provider,
    battle.p1_model,
    battle.p2_provider,
    battle.p2_model,
    battle.winner_side,
    battle.winner_provider,
    battle.winner_model,
    battle.total_turns,
    battle.started_at,
    battle.ended_at,
    JSON.stringify(battle.battle_log || []),
  ]);

  // Refresh the scoreboard
  await refreshScoreboard();
}

/**
 * Get battle history with pagination
 */
export async function getBattleHistory(
  limit = 20,
  offset = 0
): Promise<{ battles: BattleRecord[]; total: number }> {
  const countResult = await pool.query('SELECT COUNT(*) FROM battles WHERE ended_at IS NOT NULL');
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM battles
     WHERE ended_at IS NOT NULL
     ORDER BY ended_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    battles: result.rows,
    total,
  };
}

/**
 * Get a single battle by ID
 */
export async function getBattleById(battleId: string): Promise<BattleRecord | null> {
  const result = await pool.query('SELECT * FROM battles WHERE battle_id = $1', [battleId]);
  return result.rows[0] || null;
}

/**
 * Get the scoreboard
 */
export async function getScoreboard(): Promise<ScoreboardEntry[]> {
  try {
    const result = await pool.query('SELECT * FROM scoreboard ORDER BY wins DESC, win_rate DESC');
    return result.rows;
  } catch (error) {
    // If materialized view doesn't exist yet, return empty
    console.error('Scoreboard query error:', error);
    return [];
  }
}

/**
 * Refresh the scoreboard materialized view
 */
export async function refreshScoreboard(): Promise<void> {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY scoreboard');
  } catch (error) {
    // Ignore if view doesn't exist yet
    console.error('Scoreboard refresh error:', error);
  }
}

/**
 * Initialize database (run migrations)
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Read and execute schema
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await client.query(schema);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
