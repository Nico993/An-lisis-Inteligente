import { CHAT_SYSTEM_PROMPT } from './prompts.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { executeTool } from './toolExecutors.js';
import {
  extractReasoningFromMessage,
  summarizeToolResult,
  truncateStr,
} from './traceUtils.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getModel() {
  return process.env.OPENROUTER_MODEL || 'openai/o3-mini';
}

function buildChatBody(messages) {
  const effort = process.env.OPENROUTER_REASONING_EFFORT;
  const body = {
    model: getModel(),
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto',
    temperature: 0.2,
  };
  if (effort && ['low', 'medium', 'high'].includes(effort)) {
    body.reasoning = { effort };
  }
  return body;
}

/**
 * @param {(ev: Record<string, unknown>) => void} onTrace
 */
function emit(onTrace, ev) {
  if (typeof onTrace === 'function') {
    try {
      onTrace(ev);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Array<{role: string, content?: string, tool_calls?: unknown, tool_call_id?: string, name?: string}>} inputMessages
 * @param {{ maxIterations?: number, onTrace?: (ev: Record<string, unknown>) => void }} opts
 */
export async function runChatWithTools(db, inputMessages, opts = {}) {
  const maxIterations = opts.maxIterations ?? 8;
  const onTrace = opts.onTrace;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada');
  }

  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...inputMessages.map((m) => {
      const o = { role: m.role };
      if (m.content != null) o.content = m.content;
      if (m.tool_calls) o.tool_calls = m.tool_calls;
      if (m.tool_call_id) o.tool_call_id = m.tool_call_id;
      if (m.name) o.name = m.name;
      return o;
    }),
  ];

  const artifacts = { charts: [], tables: [] };

  emit(onTrace, { type: 'session_start', model: getModel(), maxIterations });

  for (let i = 0; i < maxIterations; i++) {
    emit(onTrace, { type: 'iteration', index: i });

    emit(onTrace, {
      type: 'llm_request',
      iteration: i,
      model: getModel(),
      messageCount: messages.length,
    });

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Rappi Análisis Inteligente',
      },
      body: JSON.stringify(buildChatBody(messages)),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      throw new Error('Respuesta inválida de OpenRouter');
    }

    const reasoning =
      extractReasoningFromMessage(msg) ||
      extractReasoningFromMessage(choice) ||
      (typeof data.output?.reasoning === 'string' ? data.output.reasoning.trim() : null);
    if (reasoning) {
      emit(onTrace, { type: 'thinking', iteration: i, text: reasoning });
    }

    if (msg.content && String(msg.content).trim()) {
      emit(onTrace, {
        type: 'assistant_message',
        iteration: i,
        text: truncateStr(msg.content, 1200),
      });
    }

    if (data.usage) {
      emit(onTrace, { type: 'usage', iteration: i, usage: data.usage });
    }

    messages.push({
      role: 'assistant',
      content: msg.content != null && msg.content !== '' ? msg.content : null,
      tool_calls: msg.tool_calls,
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      emit(onTrace, { type: 'finish', reason: choice.finish_reason || 'stop', iteration: i });
      return {
        text: msg.content || '',
        artifacts,
        usage: data.usage,
        finish_reason: choice.finish_reason,
      };
    }

    emit(onTrace, {
      type: 'tool_calls_pending',
      iteration: i,
      count: msg.tool_calls.length,
      names: msg.tool_calls.map((tc) => tc.function?.name).filter(Boolean),
    });

    for (const tc of msg.tool_calls) {
      const fn = tc.function;
      const name = fn?.name;
      let args = {};
      try {
        args = fn?.arguments ? JSON.parse(fn.arguments) : {};
      } catch {
        args = {};
      }

      emit(onTrace, {
        type: 'tool_call',
        iteration: i,
        id: tc.id,
        name,
        argumentsPreview: truncateStr(JSON.stringify(args), 900),
      });

      const result = executeTool(db, name, args);

      emit(onTrace, {
        type: 'tool_result',
        iteration: i,
        id: tc.id,
        name,
        summary: summarizeToolResult(name, result),
      });

      if (result.ok && name === 'query_datos' && result.rows) {
        artifacts.tables.push({
          id: tc.id,
          rows: result.rows,
          meta: result.meta,
        });
      }
      if (result.ok && name === 'generar_grafico' && result.chart) {
        artifacts.charts.push({ id: tc.id, chart: result.chart });
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content: JSON.stringify(result),
      });
    }
  }

  emit(onTrace, { type: 'finish', reason: 'max_iterations' });
  return {
    text: 'Se alcanzó el límite de iteraciones de herramientas.',
    artifacts,
    usage: null,
    finish_reason: 'max_iterations',
  };
}
