/**
 * Diccionario de métricas (negocio). No proviene del Excel; fuente de verdad textual.
 */
export const METRIC_DICTIONARY = [
  {
    name: '% PRO Users Who Breakeven',
    description:
      'Usuarios con suscripción Pro cuyo valor generado para la empresa (a través de compras, comisiones, etc.) ha cubierto el costo total de su membresía / Total de usuarios suscripción Pro',
  },
  {
    name: '% Restaurants Sessions With Optimal Assortment',
    description: 'Sesiones con un mínimo de 40 restaurantes / Total de sesiones',
  },
  {
    name: 'Gross Profit UE',
    description: 'Margen bruto de ganancia / Total de órdenes',
  },
  {
    name: 'Lead Penetration',
    description:
      'Tiendas habilitadas en Rappi / (Tiendas previamente identificadas como prospectos (leads) + Tiendas habilitadas + tiendas salieron de Rappi)',
  },
  {
    name: 'MLTV Top Verticals Adoption',
    description:
      'Usuarios con órdenes en diferentes verticales (restaurantes, super, pharmacy, liquors) / Total usuarios',
  },
  {
    name: 'Non-Pro PTC > OP',
    description: 'Conversión de usuarios No Pro en "Proceed to Checkout" a "Order Placed"',
  },
  {
    name: 'Perfect Orders',
    description: 'Orders sin cancelaciones o defectos o demora / Total de órdenes',
  },
  {
    name: 'Pro Adoption',
    description: 'Usuarios suscripción Pro / Total usuarios de Rappi',
  },
  {
    name: 'Restaurants Markdowns / GMV',
    description:
      'Descuentos totales en órdenes de restaurantes / Total Gross Merchandise Value Restaurantes',
  },
  {
    name: 'Restaurants SS > ATC CVR',
    description: 'Conversión en restaurantes de "Select Store" a "Add to Cart"',
  },
  {
    name: 'Restaurants SST > SS CVR',
    description:
      'Porcentaje de usuarios que, después de seleccionar Restaurantes o Supermercados, proceden a seleccionar una tienda en particular de la lista que se les presenta',
  },
  {
    name: 'Retail SST > SS CVR',
    description:
      'Porcentaje de usuarios que, después de seleccionar Supermercados, proceden a seleccionar una tienda en particular de la lista que se les presenta',
  },
  {
    name: 'Turbo Adoption',
    description:
      'Total de usuarios que compran en Turbo (servicio fast de Rappi) / total de usuarios de Rappi con tiendas de turbo disponible',
  },
  {
    name: 'Orders',
    description: 'Volumen de órdenes por zona y semana (tabla RAW_ORDERS)',
  },
];

/** Nombres de métricas KPI (excluye volumen de órdenes) para correlaciones / análisis. */
export const METRIC_DICTIONARY_KPI_NAMES = METRIC_DICTIONARY.filter((m) => m.name !== 'Orders').map(
  (m) => m.name
);

/** Palabras muy genéricas en preguntas al asistente (no sirven para filtrar el diccionario). */
const QUERY_STOPWORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'de',
  'del',
  'en',
  'y',
  'o',
  'a',
  'al',
  'por',
  'para',
  'con',
  'sin',
  'que',
  'muestra',
  'muestrame',
  'muéstrame',
  'ultimas',
  'últimas',
  'ultima',
  'última',
  'semanas',
  'semana',
  'metricas',
  'métricas',
  'metrica',
  'métrica',
  'evolucion',
  'evolución',
  'datos',
  'the',
  'and',
  'or',
  'for',
  'with',
]);

function tokenizeQuery(q) {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !QUERY_STOPWORDS.has(t));
}

export function findMetricEntries(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return METRIC_DICTIONARY;

  const direct = METRIC_DICTIONARY.filter((m) => {
    const name = m.name.toLowerCase();
    const desc = m.description.toLowerCase();
    if (name.includes(q) || desc.includes(q)) return true;
    if (name.length >= 2 && q.includes(name)) return true;
    return false;
  });
  if (direct.length > 0) return direct;

  const tokens = tokenizeQuery(q);
  if (tokens.length === 0) return [];

  const scored = METRIC_DICTIONARY.map((m) => {
    const hay = `${m.name} ${m.description}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += t.length;
    }
    return { entry: m, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.entry);
}

export function getDictionaryText() {
  return METRIC_DICTIONARY.map((m) => `- **${m.name}**: ${m.description}`).join('\n');
}
