import { buildInsightsReportUserPrompt, INSIGHTS_EXECUTIVE_SYSTEM_PROMPT } from './prompts.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getModel() {
  return process.env.OPENROUTER_MODEL || 'openai/o3-mini';
}

/**
 * @param {ReturnType<import('./insightsEngine.js').computeInsightFacts>} facts
 */
export async function synthesizeExecutiveReport(facts) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY no está configurada');
  }

  const user = buildInsightsReportUserPrompt(facts);

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Rappi Insights',
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: 'system', content: INSIGHTS_EXECUTIVE_SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      temperature: 0.25,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { markdown: text, usage: data.usage };
}
