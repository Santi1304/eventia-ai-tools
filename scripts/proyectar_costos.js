#!/usr/bin/env node
// Proyección mensual de costos (100 / 1,000 / 10,000 casos) con escenario base y de mayor consumo.
// Usa el costo LLM MEDIDO de costos/costos_operacion.csv si existe; si no, usa una ESTIMACIÓN declarada.
// Uso: node scripts/proyectar_costos.js   → costos/proyecciones.csv y costos/proyecciones.md
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

// ── Parámetros declarados (supuestos; cámbialos aquí y documenta el cambio) ──
const S = {
  base: { voz_pct: 0.30, min_por_conversacion: 2, llm_voz_usd_min: 0.01, ejecuciones_n8n_por_caso: 3, reintentos_factor: 1.05 },
  alto: { voz_pct: 0.50, min_por_conversacion: 4, llm_voz_usd_min: 0.0446, ejecuciones_n8n_por_caso: 5, reintentos_factor: 1.25 }
};
const VOZ = { planes: [{ nombre: 'Free', usd: 0, min: 15 }, { nombre: 'Starter', usd: 6, min: 75 }, { nombre: 'Creator', usd: 22, min: 275 }, { nombre: 'Pro', usd: 99, min: 1238 }, { nombre: 'Scale', usd: 299, min: 3738 }], extra_usd_min: 0.08 };
const N8N = { planes: [{ nombre: 'Starter', eur: 20, ejec: 2500 }, { nombre: 'Pro', eur: 50, ejec: 10000 }], eur_usd: 1.08 };   // eur_usd: SUPUESTO, verificar
const EJEC_PROGRAMADAS = { cada_10_min: 6 * 24 * 30, cada_hora: 24 * 30 };
const VOLUMENES = [100, 1000, 10000];

function llmPorCaso() {
  const f = path.join(raiz, 'costos', 'costos_operacion.csv');
  if (fs.existsSync(f)) {
    const [cab, ...filas] = fs.readFileSync(f, 'utf8').trim().split('\n');
    const c = cab.split(',');
    const rows = filas.filter(Boolean).map((l) => Object.fromEntries(l.split(',').map((v, i) => [c[i], v])));
    const medidas = rows.filter((r) => r.origen === 'medido');
    const casos = new Set(medidas.map((r) => r.caso_id));
    if (casos.size >= 3) {
      const total = medidas.reduce((s, r) => s + Number(r.costo_usd || 0), 0);
      return { usd: total / casos.size, origen: 'medido', n: casos.size };
    }
  }
  // Estimación: 6 llamadas por caso completo (A1, A2, A3×1.3, A4×1.2) con prompts reales del núcleo ~ 700 tokens de entrada
  // y salidas de 150–400 tokens. (6×700×0.10 + (120+150+400×1.3+60×1.2)×0.50)/1e6
  const usd = (6 * 700 * 0.10 + (120 + 150 + 400 * 1.3 + 60 * 1.2) * 0.50) / 1e6;
  return { usd, origen: 'estimado', n: 0 };
}

function planVoz(min) {
  const opciones = VOZ.planes.map((p) => ({ nombre: p.nombre, usd: p.usd + Math.max(0, min - p.min) * VOZ.extra_usd_min }));
  return opciones.sort((a, b) => a.usd - b.usd)[0];
}
function planN8n(ejec) {
  const p = N8N.planes.find((x) => ejec <= x.ejec);
  return p ? { nombre: p.nombre, usd: p.eur * N8N.eur_usd } : { nombre: 'Business/autohospedado (fuera de tabla)', usd: null };
}

const llm = llmPorCaso();
const filas = [];
for (const esc of ['base', 'alto']) {
  const s = S[esc];
  for (const v of VOLUMENES) {
    for (const prog of ['cada_10_min', 'cada_hora']) {
      const llmMes = v * llm.usd * s.reintentos_factor;
      const minutos = v * s.voz_pct * s.min_por_conversacion;
      const voz = planVoz(minutos);
      const vozLLM = minutos * s.llm_voz_usd_min;
      const ejec = v * s.ejecuciones_n8n_por_caso + EJEC_PROGRAMADAS[prog];
      const n8n = planN8n(ejec);
      const total = n8n.usd == null ? null : llmMes + voz.usd + vozLLM + n8n.usd;
      filas.push({ escenario: esc, casos_mes: v, tarea_programada: prog, llm_usd: llmMes, minutos_voz: minutos, plan_voz: voz.nombre, voz_plataforma_usd: voz.usd,
        voz_llm_usd: vozLLM, ejecuciones_n8n: ejec, plan_n8n: n8n.nombre, n8n_usd: n8n.usd, total_usd: total, usd_por_caso: total == null ? null : total / v });
    }
  }
}
const f2 = (x, d = 2) => (x == null ? 'n/d' : Number(x).toFixed(d));
const cols = Object.keys(filas[0]);
fs.writeFileSync(path.join(raiz, 'costos', 'proyecciones.csv'), cols.join(',') + '\n' + filas.map((r) => cols.map((c) => (typeof r[c] === 'number' ? +r[c].toFixed(6) : r[c] == null ? '' : r[c])).join(',')).join('\n') + '\n');
const md = ['# Proyección mensual de costos', '',
  '> Generado por `scripts/proyectar_costos.js` el ' + new Date().toISOString().slice(0, 10) + '. Costo LLM por caso: **' + f2(llm.usd, 6) + ' USD (' + llm.origen + (llm.n ? ', n = ' + llm.n + ' casos' : '') + ')**.',
  '> Supuestos (no medidos): mezcla de voz, minutos por conversación, LLM de voz por minuto, ejecuciones n8n por caso, factor de reintentos y tipo EUR/USD ' + N8N.eur_usd + '. Se supone que todos los planes de voz permiten minutos adicionales a 0.08 USD (verificar; si el plan Free no lo permite, el plan mínimo cambia). Tarifas de voz y n8n de fuentes secundarias: verificar en las páginas oficiales.', '',
  '| Escenario | Casos/mes | Tarea programada | LLM USD | Min voz | Plan voz | Voz USD | LLM voz USD | Ejec. n8n | Plan n8n | n8n USD | **Total USD** | USD/caso |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
  .concat(filas.map((r) => '| ' + [r.escenario, r.casos_mes, r.tarea_programada, f2(r.llm_usd, 4), r.minutos_voz, r.plan_voz, f2(r.voz_plataforma_usd), f2(r.voz_llm_usd), r.ejecuciones_n8n, r.plan_n8n, f2(r.n8n_usd), '**' + f2(r.total_usd) + '**', f2(r.usd_por_caso, 4)].join(' | ') + ' |'))
  .concat(['', '**Lectura:** el costo de modelo (LLM) es marginal frente a la plataforma de voz y a n8n; a 10,000 casos el plan de n8n deja de alcanzar y la voz domina el costo variable. ' +
    'La tarea programada cada 10 min consume ' + EJEC_PROGRAMADAS.cada_10_min + ' ejecuciones/mes por sí sola (más que el plan Starter); cambiarla a cada hora libera ' + (EJEC_PROGRAMADAS.cada_10_min - EJEC_PROGRAMADAS.cada_hora) + ' ejecuciones sin tocar controles: el vencimiento también se verifica al intentar aprobar.']);
fs.writeFileSync(path.join(raiz, 'costos', 'proyecciones.md'), md.join('\n') + '\n');
console.log('✓ proyecciones (' + llm.origen + ') → costos/proyecciones.md');
