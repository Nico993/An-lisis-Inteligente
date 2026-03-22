import { getDb } from '@/lib/db.js';
import { computeInsightFacts } from '@/lib/insightsEngine.js';
import { synthesizeExecutiveReport } from '@/lib/insightsSynthesis.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  try {
    const db = await getDb();
    const facts = computeInsightFacts(db);
    return Response.json({ facts });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const synthesize = body?.synthesize !== false;

    const db = await getDb();
    const facts = computeInsightFacts(db);

    if (!synthesize) {
      return Response.json({ facts, markdown: '' });
    }

    const { markdown, usage } = await synthesizeExecutiveReport(facts);
    return Response.json({ facts, markdown, usage });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
