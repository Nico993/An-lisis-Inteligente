import { getDb } from '@/lib/db.js';
import { runChatWithTools } from '@/lib/openrouter.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, stream: wantStream } = body;
    if (!Array.isArray(messages)) {
      return Response.json({ error: 'messages debe ser un array' }, { status: 400 });
    }

    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content }));

    const db = await getDb();

    if (wantStream === false) {
      const result = await runChatWithTools(db, clean);
      return Response.json({
        reply: result.text,
        artifacts: result.artifacts,
        usage: result.usage,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        };

        try {
          const result = await runChatWithTools(db, clean, {
            onTrace: (ev) => send(ev),
          });
          send({
            type: 'done',
            reply: result.text,
            artifacts: result.artifacts,
            usage: result.usage,
            finish_reason: result.finish_reason,
          });
        } catch (e) {
          send({ type: 'error', message: e?.message || String(e) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e?.message || 'Error en el chat' },
      { status: 500 }
    );
  }
}
