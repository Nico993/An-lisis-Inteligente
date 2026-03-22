# Arquitectura y decisiones técnicas

Este documento resume **por qué** se eligieron las piezas principales del Sistema de Análisis Inteligente (caso Rappi).

## Datos: Excel → SQLite

- **Entrada:** archivo Excel con hojas `RAW_INPUT_METRICS`, `RAW_ORDERS` y opcionalmente `RAW_SUMMARY` (glosario de columnas).
- **Persistencia:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) en `data/app.db`, recreada o actualizada cuando cambia el mtime del Excel ([`lib/db.js`](../lib/db.js)).
- **Por qué SQLite:** ejecución local sin levantar un servidor de base de datos, consultas SQL predecibles, un solo archivo para reproducir la demo y tests. Encaja con el requisito de “localhost es suficiente”.

## LLM: OpenRouter

- **Proveedor:** [OpenRouter](https://openrouter.ai/) expone una API compatible con OpenAI (`/v1/chat/completions`) y unifica facturación y acceso a varios modelos.
- **Por qué:** evita acoplarse a un solo vendor; permite cambiar de modelo con `OPENROUTER_MODEL` sin reescribir la orquestación ([`lib/openrouter.js`](../lib/openrouter.js), [`lib/insightsSynthesis.js`](../lib/insightsSynthesis.js)).

## Modelo por defecto: `openai/o3-mini`

- Modelo de **razonamiento** de OpenAI vía OpenRouter, con soporte de **tool calling**.
- **Trade-off:** menor coste aproximado que familias GPT-4 completas, a cambio de revisar límites de tokens en conversaciones largas con muchas herramientas. El coste orientativo está en el README.

## Patrón del chat: herramientas + validación

- El modelo **no inventa números**: obtiene cifras solo de herramientas (`query_datos`, `analizar_crecimiento_ordenes`, `calcular`, etc.).
- **`query_datos`** construye SQL a partir de parámetros validados con [Zod](https://zod.dev/) ([`lib/queryBuilder.js`](../lib/queryBuilder.js)): reduce inyección SQL y argumentos inválidos.
- **`analizar_crecimiento_ordenes`** encapsula la lógica de crecimiento de órdenes vs KPIs en `metrics` (la tabla `orders` no trae `zone_type`).

## Insights automáticos

- **Hechos:** reglas determinísticas en [`lib/insightsEngine.js`](../lib/insightsEngine.js) (anomalías WoW, tendencias, benchmarking, correlaciones Pearson entre pares de métricas con datos suficientes, bloques de oportunidades por reglas de negocio).
- **Narrativa opcional:** el mismo LLM sintetiza un informe en Markdown a partir del JSON de hechos, sin volver a consultar la base ([`lib/insightsSynthesis.js`](../lib/insightsSynthesis.js)).
- **Gráficos en UI:** specs derivadas de los hechos y marcadores `<!-- INSIGHT_CHART:... -->` en el Markdown ([`lib/insightsCharts.js`](../lib/insightsCharts.js)).

## Frontend y API

- **Next.js 14 (App Router):** UI en React, rutas API en `app/api/*/route.js` para chat streaming (NDJSON) e insights JSON/Markdown.
- **Gráficos:** Recharts en componentes de artefactos; export PDF del informe con html2canvas + jsPDF en el cliente.

## Extensiones futuras (ideas)

- Ingesta directa desde CSV además de Excel.
- Persistencia de sesiones de chat en servidor o almacenamiento local estructurado.
- Colas o jobs para informes programados y envío por email (fuera del alcance mínimo actual).
