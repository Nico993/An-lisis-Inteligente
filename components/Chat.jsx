'use client';

import { useCallback, useState } from 'react';
import { Message } from './Message.jsx';
import { LiveTracePanel } from './LiveTracePanel.jsx';

const SUGGESTIONS = [
  '¿Cuáles son las 5 zonas con mayor Lead Penetration esta semana (l0w)?',
  'Compara Perfect Orders entre zonas Wealthy y Non Wealthy en México',
  'Muestra la evolución de Gross Profit UE en Chapinero en las últimas 8 semanas',
  '¿Cuál es el promedio de Lead Penetration por país?',
  '¿Qué zonas tienen alto Lead Penetration pero bajo Perfect Order?',
  '¿Qué zonas crecen más en órdenes en las últimas 5 semanas y qué métricas podrían explicarlo?',
];

async function readNdjsonStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('El navegador no soporta lectura del stream');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let ev;
      try {
        ev = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (ev.type === 'done') {
        donePayload = ev;
        continue;
      }
      if (ev.type === 'error') {
        throw new Error(ev.message || 'Error en el stream');
      }
      onEvent(ev);
    }
  }

  const rest = buffer.trim();
  if (rest) {
    try {
      const ev = JSON.parse(rest);
      if (ev.type === 'done') donePayload = ev;
      else if (ev.type === 'error') throw new Error(ev.message || 'Error');
      else onEvent(ev);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Error')) throw e;
    }
  }

  if (!donePayload) {
    throw new Error('Respuesta incompleta del servidor');
  }
  return donePayload;
}

export function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [traceEvents, setTraceEvents] = useState([]);
  const [traceActive, setTraceActive] = useState(false);

  const send = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed || loading) return;

      setError(null);
      setTraceEvents([]);
      setTraceActive(true);

      const nextUser = { role: 'user', content: trimmed };
      const history = [...messages, nextUser];
      setMessages(history);
      setInput('');
      setLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error ${res.status}`);
        }

        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('ndjson')) {
          const data = await res.json();
          setMessages([
            ...history,
            {
              role: 'assistant',
              content: data.reply || '',
              artifacts: data.artifacts,
            },
          ]);
          setTraceActive(false);
          return;
        }

        const donePayload = await readNdjsonStream(res, (ev) => {
          setTraceEvents((prev) => [...prev, ev]);
        });

        setMessages([
          ...history,
          {
            role: 'assistant',
            content: donePayload.reply || '',
            artifacts: donePayload.artifacts,
          },
        ]);
      } catch (e) {
        setError(e?.message || 'Error');
        setInput(trimmed);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
        setTraceActive(false);
      }
    },
    [loading, messages]
  );

  return (
    <div className="chat-layout">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <h1 className="chat-empty-title">¿Qué querés ver?</h1>
            <p className="chat-empty-lead">Preguntas sobre zonas, métricas o tendencias.</p>
            <p className="chat-empty-label">Ejemplos</p>
            <div className="suggestion-grid">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => send(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <Message
            key={i}
            role={m.role}
            content={m.content}
            artifacts={m.role === 'assistant' ? m.artifacts : null}
          />
        ))}

        {loading && traceEvents.length === 0 ? (
          <p className="status-line">Conectando…</p>
        ) : null}
        {error ? <p className="status-line status-line--error">{error}</p> : null}
      </div>

      <LiveTracePanel events={traceEvents} active={traceActive || loading} />

      <div className="composer">
        <div className="composer-inner">
          <textarea
            className="composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Escribí una pregunta…"
            aria-label="Mensaje"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button type="button" className="btn-send" onClick={() => send(input)} disabled={loading}>
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
