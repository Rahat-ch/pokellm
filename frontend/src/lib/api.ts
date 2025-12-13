const API_BASE = '/api';

export interface Provider {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
}

export interface ScoreboardEntry {
  provider: string;
  model: string;
  wins: number;
  losses: number;
  total_battles: number;
  win_rate: number;
}

export interface BattleRecord {
  id: string;
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
  started_at: string;
  ended_at: string | null;
}

export async function getProviders(): Promise<Provider[]> {
  const res = await fetch(`${API_BASE}/battle/providers`);
  const data = await res.json();
  return data.providers;
}

export async function getBattleStatus() {
  const res = await fetch(`${API_BASE}/battle/status`);
  return res.json();
}

export async function startBattle(
  p1: { provider: string; model: string },
  p2: { provider: string; model: string }
): Promise<{ battleId: string; status: string }> {
  const res = await fetch(`${API_BASE}/battle/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p1, p2 }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to start battle');
  }

  return res.json();
}

export async function getScoreboard(): Promise<ScoreboardEntry[]> {
  const res = await fetch(`${API_BASE}/scoreboard`);
  const data = await res.json();
  return data.scoreboard;
}

export async function getHistory(
  limit = 20,
  offset = 0
): Promise<{ battles: BattleRecord[]; total: number; hasMore: boolean }> {
  const res = await fetch(`${API_BASE}/history?limit=${limit}&offset=${offset}`);
  return res.json();
}
