import { useState, useEffect } from 'react';
import { getScoreboard, ScoreboardEntry } from '../lib/api';

export function Scoreboard() {
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getScoreboard();
        setScoreboard(data);
      } catch (err) {
        console.error('Failed to load scoreboard:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="loading">Loading scoreboard...</div>;
  }

  return (
    <div className="scoreboard">
      <h1>Leaderboard</h1>

      {scoreboard.length === 0 ? (
        <div className="empty-state card">
          <p>No battles have been recorded yet.</p>
          <p>Start a battle to see the leaderboard!</p>
        </div>
      ) : (
        <table className="scoreboard-table card">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Model</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {scoreboard.map((entry, index) => (
              <tr key={`${entry.provider}-${entry.model}`}>
                <td>#{index + 1}</td>
                <td>
                  <strong>{entry.provider}</strong>/{entry.model}
                </td>
                <td style={{ color: 'var(--success)' }}>{entry.wins}</td>
                <td style={{ color: 'var(--p2-color)' }}>{entry.losses}</td>
                <td className="win-rate">{entry.win_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
