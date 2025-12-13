import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App } from './App';
import { Home } from './pages/Home';
import { Battle } from './pages/Battle';
import { History } from './pages/History';
import { Scoreboard } from './pages/Scoreboard';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="battle" element={<Battle />} />
          <Route path="history" element={<History />} />
          <Route path="scoreboard" element={<Scoreboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
