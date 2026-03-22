#!/usr/bin/env node
/**
 * Ejemplo de coste orientativo OpenRouter (sin llamar a la API).
 * Uso: node scripts/print-cost-example.mjs --model openai/o3-mini --questions 10 --input-per-turn 4500 --output-per-turn 900 --turns-per-question 3
 */
const args = process.argv.slice(2);

function getArg(name, def) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1] != null) return args[i + 1];
  return def;
}

const model = getArg('--model', process.env.OPENROUTER_MODEL || 'openai/o3-mini');
const questions = Number(getArg('--questions', '10'));
const inputPerTurn = Number(getArg('--input-per-turn', '4500'));
const outputPerTurn = Number(getArg('--output-per-turn', '900'));
const turnsPerQuestion = Number(getArg('--turns-per-question', '3'));
// Defaults orientativos para openai/o3-mini en OpenRouter; verificá la ficha actual.
const inputPrice = Number(getArg('--input-price-per-m', '1.10'));
const outputPrice = Number(getArg('--output-price-per-m', '4.40'));

const totalTurns = questions * turnsPerQuestion;
const inputTokens = totalTurns * inputPerTurn;
const outputTokens = totalTurns * outputPerTurn;
const costUsd = (inputTokens / 1e6) * inputPrice + (outputTokens / 1e6) * outputPrice;

console.log(`Modelo (ejemplo): ${model}`);
console.log(`Supuestos: ${questions} preguntas × ${turnsPerQuestion} llamadas al modelo c/u`);
console.log(`Tokens por llamada: ~${inputPerTurn} input + ~${outputPerTurn} output`);
console.log(`Precios ejemplo ($/1M): input ${inputPrice}, output ${outputPrice} (reemplazá por la ficha actual en openrouter.ai)`);
console.log('');
console.log(`Tokens input totales (aprox.): ${Math.round(inputTokens)}`);
console.log(`Tokens output totales (aprox.): ${Math.round(outputTokens)}`);
console.log(`Coste estimado (USD, solo ilustrativo): ~$${costUsd.toFixed(3)}`);
