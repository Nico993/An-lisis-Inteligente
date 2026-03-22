# Análisis Inteligente — Caso Rappi

Chat sobre métricas operacionales (tools + SQL validado) e **insights automáticos** (reglas + informe Markdown/PDF). **Next.js 14**, **SQLite**, **OpenRouter** (`openai/o3-mini` por defecto).

**Arquitectura detallada:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Cómo ejecutarlo

```bash
git clone <URL>.git && cd Analisis-Inteligente
npm install
cp .env.example .env   # pegar OPENROUTER_API_KEY
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) — pestañas **Chat** e **Insights**.

**Producción local:** `npm run build && npm start`

---

## Datos (Excel)

El Excel **dummy del caso** va versionado en el repo. Ruta recomendada (corta, estable en GitHub): **`data/dummy.xlsx`**. También se detecta el nombre largo original en la raíz del proyecto. Si usás **otro nombre**, definí la ruta absoluta en **`DATA_XLSX_PATH`** en `.env` (si no, la app no encuentra el archivo y no carga datos).

Hojas esperadas: **`RAW_INPUT_METRICS`**, **`RAW_ORDERS`**; opcional **`RAW_SUMMARY`**. Se genera `data/app.db` al arrancar (ignorado por git). Detalle de columnas: `lib/excelIngest.js`.

---

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `OPENROUTER_API_KEY` | Obligatoria. |
| `OPENROUTER_MODEL` | Opcional; default `openai/o3-mini`. |
| `DATA_XLSX_PATH` | Opcional; solo si el `.xlsx` no está en ninguna de las rutas por defecto. |

No commitees `.env` (está en `.gitignore`).

---

## Costos del LLM (OpenRouter)

**Cómo se factura:** OpenRouter cobra **tokens de entrada** y **tokens de salida** por llamada al modelo, según el [precio publicado del modelo](https://openrouter.ai/models) (USD por millón de tokens). El coste real depende del modelo (`OPENROUTER_MODEL`), del largo del **historial**, de los **resultados de las tools** (suelen ser muchos tokens de entrada) y de cuántas iteraciones tool↔modelo haya por pregunta.

**Modelo por defecto (`openai/o3-mini`):** en la ficha de OpenRouter el precio de referencia es del orden de **~$1.10 / 1M tokens de entrada** y **~$4.40 / 1M tokens de salida** (los valores exactos cambian; **confirmalos siempre** en [openai/o3-mini](https://openrouter.ai/openai/o3-mini) antes de estimar).

**Fórmula (una sesión):**  
`USD ≈ (tokens_in / 1_000_000) × precio_input + (tokens_out / 1_000_000) × precio_output`  
(`precio_input` / `precio_output` = USD por millón de tokens del modelo en OpenRouter).

**Ejemplo numérico (solo ilustrativo):** 10 preguntas, 3 llamadas al modelo por pregunta, ~4.500 tokens de entrada y ~900 de salida **por llamada** → ~135.000 tokens de entrada y ~27.000 de salida en total. Con los precios de referencia de `o3-mini` de arriba: **≈ US$ 0,27** por esa sesión. En la práctica, si las tools devuelven tablas grandes, los tokens de entrada pueden ser varias veces mayores.

**Script de sensibilidad** (sin llamar a la API; ajustá precios con `--input-price-per-m` y `--output-price-per-m` según la ficha actual):

```bash
npm run cost-example -- --questions 10 --turns-per-question 3 --input-per-turn 4500 --output-per-turn 900
```

---

## Decisiones (resumen)

- **OpenRouter:** API tipo OpenAI, cambio de modelo sin reescribir el servidor.
- **o3-mini:** razonamiento + tool calling; coste suele ser menor que GPT-4 “grandes” (ver sección anterior).
- **SQLite:** cero infraestructura externa; `app.db` se genera localmente.
- **Tools + Zod:** los números salen de consultas validadas, no de texto libre del modelo.
- **Insights:** hechos con reglas en código; el LLM solo redacta el informe a partir del JSON.

---

## Si algo falla

- Build raro: borrá `.next` y `npm run build` de nuevo.
- Sin datos: comprobá que el `.xlsx` esté en el repo en una ruta soportada por `lib/db.js` o `DATA_XLSX_PATH`.
- API: key y crédito en OpenRouter.

---

Licencia: ISC (`package.json`).
