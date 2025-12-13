import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProviders, startBattle, getBattleStatus, Provider } from '../lib/api';

export function Home() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [battleActive, setBattleActive] = useState(false);

  const [p1Provider, setP1Provider] = useState('');
  const [p1Model, setP1Model] = useState('');
  const [p2Provider, setP2Provider] = useState('');
  const [p2Model, setP2Model] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [providerList, status] = await Promise.all([
          getProviders(),
          getBattleStatus(),
        ]);

        setProviders(providerList);
        setBattleActive(status.active);

        if (providerList.length > 0) {
          setP1Provider(providerList[0].id);
          setP1Model(providerList[0].defaultModel);

          if (providerList.length > 1) {
            setP2Provider(providerList[1].id);
            setP2Model(providerList[1].defaultModel);
          } else {
            setP2Provider(providerList[0].id);
            setP2Model(providerList[0].defaultModel);
          }
        }
      } catch (err) {
        setError('Failed to load providers');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleP1ProviderChange = (providerId: string) => {
    setP1Provider(providerId);
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      setP1Model(provider.defaultModel);
    }
  };

  const handleP2ProviderChange = (providerId: string) => {
    setP2Provider(providerId);
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      setP2Model(provider.defaultModel);
    }
  };

  const handleStartBattle = async () => {
    setStarting(true);
    setError(null);

    try {
      await startBattle(
        { provider: p1Provider, model: p1Model },
        { provider: p2Provider, model: p2Model }
      );
      navigate('/battle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start battle');
    } finally {
      setStarting(false);
    }
  };

  const p1ProviderObj = providers.find((p) => p.id === p1Provider);
  const p2ProviderObj = providers.find((p) => p.id === p2Provider);

  if (loading) {
    return <div className="loading">Loading providers...</div>;
  }

  return (
    <div className="home">
      <h1>PokeLLM</h1>
      <p>Watch AI models battle each other in Pokemon! Select two LLMs and let them fight.</p>

      {error && <div className="error" style={{ color: 'var(--p2-color)' }}>{error}</div>}

      {battleActive && (
        <div className="battle-status active">
          <p>A battle is currently in progress!</p>
          <button className="btn btn-primary" onClick={() => navigate('/battle')}>
            Watch Battle
          </button>
        </div>
      )}

      <div className="battle-setup">
        <div className="player-select p1">
          <label>Player 1</label>
          <select value={p1Provider} onChange={(e) => handleP1ProviderChange(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={p1Model} onChange={(e) => setP1Model(e.target.value)}>
            {p1ProviderObj?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <span className="vs">VS</span>

        <div className="player-select p2">
          <label>Player 2</label>
          <select value={p2Provider} onChange={(e) => handleP2ProviderChange(e.target.value)}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={p2Model} onChange={(e) => setP2Model(e.target.value)}>
            {p2ProviderObj?.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleStartBattle}
        disabled={starting || battleActive || !p1Provider || !p2Provider}
      >
        {starting ? 'Starting...' : battleActive ? 'Battle in Progress' : 'Start Battle'}
      </button>
    </div>
  );
}
