/**
 * Definiciones de tools para OpenRouter (formato OpenAI-compatible).
 */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'query_datos',
      description:
        'Consulta segura sobre las tablas de métricas (RAW_INPUT_METRICS → metrics) u órdenes (RAW_ORDERS → orders). Usa SIEMPRE esta herramienta para obtener números; no inventes cifras. Semanas: l8w (hace 8) … l0w (actual).',
      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['metrics', 'orders'],
            description:
              'metrics: KPIs operacionales; orders: volumen Orders por zona.',
          },
          mode: {
            type: 'string',
            enum: ['rows', 'aggregate'],
            description: 'rows: filas detalladas; aggregate: agrupar con avg/sum/min/max.',
          },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description:
                    'Campos: metrics: country, city, zone, zone_type, zone_prioritization, metric, o columnas de semana l0w…l8w. orders: country, city, zone, metric, l0w…l8w.',
                },
                op: { type: 'string', enum: ['eq', 'ne', 'in', 'like', 'gte', 'lte'] },
                value: {
                  description: 'string, número, o array de strings para op=in',
                },
              },
              required: ['field', 'op', 'value'],
            },
          },
          group_by: {
            type: 'array',
            items: { type: 'string' },
            description: 'Requerido si mode=aggregate (ej. zone_type, zone, country).',
          },
          week_field: {
            type: 'string',
            enum: ['l8w', 'l7w', 'l6w', 'l5w', 'l4w', 'l3w', 'l2w', 'l1w', 'l0w'],
            description: 'Semana base para ordenar o agregar (típicamente l0w).',
          },
          include_weeks: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['l8w', 'l7w', 'l6w', 'l5w', 'l4w', 'l3w', 'l2w', 'l1w', 'l0w'],
            },
            description: 'Para tendencias: limitar columnas de semanas devueltas.',
          },
          aggregation: {
            type: 'string',
            enum: ['none', 'avg', 'sum', 'min', 'max'],
            description: 'Para mode=aggregate usar avg/sum/min/max (no none).',
          },
          order_by: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] },
            },
          },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
        required: ['source'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calcular',
      description:
        'Evalúa una expresión matemática con mathjs usando solo variables explícitas (números ya obtenidos de query_datos). No uses para inventar datos.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Ej: ((l0w - l1w) / l1w) * 100 con variables definidas abajo.',
          },
          variables: {
            type: 'object',
            additionalProperties: { type: 'number' },
            description: 'Mapa nombre → número para sustituir en la expresión.',
          },
        },
        required: ['expression', 'variables'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analizar_crecimiento_ordenes',
      description:
        'OBLIGATORIA para preguntas del tipo: zonas que más crecen en órdenes, qué podría explicar el crecimiento, drivers del volumen. Devuelve ranking por zona con tasa (l0w vs l5w) y snapshot de KPIs (Perfect Orders, Lead Penetration, Gross Profit UE, etc.) en la misma zona. No inventa números: todo sale de SQLite.',
      parameters: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            description: 'Código de país opcional (ej. MX, CO). Si se omite, todos los países.',
          },
          top_n: {
            type: 'integer',
            description: 'Cantidad de zonas top por crecimiento (default 10, máx 50).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generar_grafico',
      description:
        'Define un gráfico (spec JSON) a partir de datos ya consultados. La UI lo renderiza; luego explicas el gráfico en texto.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['line', 'bar'] },
          title: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                values: { type: 'array', items: { type: 'number' } },
              },
              required: ['name', 'values'],
            },
          },
        },
        required: ['type', 'labels', 'series'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obtener_diccionario_metricas',
      description:
        'Devuelve descripciones de negocio de métricas (nombres pueden no coincidir 1:1 con el campo METRIC del Excel).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto opcional para filtrar por nombre o descripción.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obtener_schema_columnas',
      description:
        'Glosario de columnas del Excel (hoja RAW_SUMMARY) y tipos inferidos.',
      parameters: { type: 'object', properties: {} },
    },
  },
];
