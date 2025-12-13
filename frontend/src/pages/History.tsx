import { useState, useEffect } from 'react';
import { getHistory, BattleRecord } from '../lib/api';

export function History() {
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getHistory(20, 0);
        setBattles(data.battles);
        setTotal(data.total);
        setHasMore(data.hasMore);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const loadMore = async () => {
    try {
      const data = await getHistory(20, battles.length);
      setBattles([...battles, ...data.battles]);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading battle history...</div>;
  }

  return (
    <div className="history">
      <h1>Battle History</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {total} battles recorded
      </p>

      {battles.length === 0 ? (
        <div className="empty-state card">
          <p>No battles have been recorded yet.</p>
          <p>Start a battle to see the history!</p>
        </div>
      ) : (
        <>
          <div className="history-list">
            {battles.map((battle) => (
              <div key={battle.battle_id} className="history-item card">
                <div className="history-players">
                  <span
                    className={`history-player ${battle.winner_side === 'p1' ? 'winner' : ''}`}
                  >
                    {battle.p1_provider}/{battle.p1_model}
                  </span>
                  <span className="history-vs">vs</span>
                  <span
                    className={`history-player ${battle.winner_side === 'p2' ? 'winner' : ''}`}
                  >
                    {battle.p2_provider}/{battle.p2_model}
                  </span>
                </div>
                <div className="history-meta">
                  <div className="history-turns">{battle.total_turns} turns</div>
                  <div>{formatDate(battle.ended_at)}</div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={loadMore}>
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'In progress';

  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Otherwise show date
  return date.toLocaleDateString();
}
