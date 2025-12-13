import { Outlet, Link, useLocation } from 'react-router-dom';

export function App() {
  const location = useLocation();

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          PokeLLM
        </Link>
        <nav className="nav">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Home
          </Link>
          <Link to="/battle" className={location.pathname === '/battle' ? 'active' : ''}>
            Battle
          </Link>
          <Link to="/scoreboard" className={location.pathname === '/scoreboard' ? 'active' : ''}>
            Scoreboard
          </Link>
          <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
            History
          </Link>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
