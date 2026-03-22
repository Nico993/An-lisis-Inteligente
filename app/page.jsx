'use client';

import { useState } from 'react';
import { Chat } from '@/components/Chat.jsx';
import { InsightsPanel } from '@/components/InsightsPanel.jsx';

export default function HomePage() {
  const [tab, setTab] = useState('chat');

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-brand">
          <span className="app-brand-mark">Análisis</span>
          <span className="app-brand-sub">Rappi · operaciones</span>
        </div>
        <nav className="app-tabs" aria-label="Vista principal">
          <button
            type="button"
            className={`app-tab${tab === 'chat' ? ' app-tab--active' : ''}`}
            onClick={() => setTab('chat')}
            aria-pressed={tab === 'chat'}
          >
            Chat
          </button>
          <button
            type="button"
            className={`app-tab${tab === 'insights' ? ' app-tab--active' : ''}`}
            onClick={() => setTab('insights')}
            aria-pressed={tab === 'insights'}
          >
            Insights
          </button>
        </nav>
      </header>
      <main className="app-main">{tab === 'chat' ? <Chat /> : <InsightsPanel />}</main>
    </div>
  );
}
