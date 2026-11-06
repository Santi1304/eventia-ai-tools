#!/usr/bin/env node
// Exporta el registro privado (n8n) a archivos públicos sanitizados del repositorio.
//   Desde n8n:   N8N_EXPORT_URL="https://TU-INSTANCIA/webhook/eventia-export" EVENTIA_EXPORT_KEY="..." node scripts/exportar.js
//   Desde archivo: node scripts/exportar.js ruta/export.json
//   Estado vacío inicial: node scripts/exportar.js --vacio
// Escribe: web/datos/publico.json · costos/costos_operacion.csv · evidencias/trazas/<folio>.json
// Después: git add, commit y push → GitHub Actions valida y publica.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

const COLUMNAS = ['fecha_hora', 'caso_id', 'llamada_id', 'etapa', 'agente', 'proveedor', 'modelo', 'tokens_entrada', 'tokens_salida',
  'cache_lectura', 'cache_escritura', 'duracion_voz_s', 'unidad_cobro', 'tarifa_entrada_usd_mtok', 'tarifa_salida_usd_mtok', 'costo_usd',
  'moneda', 'estado', 'reintento', 'origen', 'duracion_ms', 'iteracion', 'skill_version', 'modo', 'detalle'];
const PROHIBIDAS = /"(chat_id|_privado|texto_original|telefono|email|from|username|first_name|last_name)"\s*:/;

function csv(filas) {
  const celda = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return COLUMNAS.join(',') + '\n' + filas.map((f) => COLUMNAS.map((c) => celda(f[c])).join(',')).join('\n') + '\n';
}

async function obtener() {
  if (process.argv.includes('--vacio')) {
    const N = require('../agentes/nucleo.js');
    return { publico: N.exportarPublico(N.iniciarAlmacen({})), costos: [], trazas: [] };
  }
  const arch = process.argv[2];
  if (arch) return JSON.parse(fs.readFileSync(arch, 'utf8'));
  const url = process.env.N8N_EXPORT_URL, clave = process.env.EVENTIA_EXPORT_KEY, enc = process.env.EVENTIA_EXPORT_HEADER || 'x-eventia-key';
  if (!url || !clave) { console.error('Define N8N_EXPORT_URL y EVENTIA_EXPORT_KEY, o pasa un archivo.'); process.exit(2); }
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'todas=1', { headers: { [enc]: clave } });
  if (!r.ok) { console.error('Exportación falló: HTTP ' + r.status); process.exit(1); }
  return r.json();
}

(async () => {
  const exp = await obtener();
  const publico = exp.publico;
  const texto = JSON.stringify(publico);
  if (PROHIBIDAS.test(texto)) { console.error('✗ La exportación contiene campos privados. No se escribió nada.'); process.exit(1); }
  fs.mkdirSync(path.join(raiz, 'web', 'datos'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'web', 'datos', 'publico.json'), JSON.stringify(publico, null, 2) + '\n');
  fs.mkdirSync(path.join(raiz, 'costos'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'costos', 'costos_operacion.csv'), csv(exp.costos || []));
  const trazas = exp.trazas || (exp.traza ? [exp.traza] : []);
  if (trazas.length) {
    fs.mkdirSync(path.join(raiz, 'evidencias', 'trazas'), { recursive: true });
    trazas.forEach((t) => {
      if (PROHIBIDAS.test(JSON.stringify(t))) { console.error('✗ traza ' + t.caso_id + ' con campos privados; omitida'); return; }
      fs.writeFileSync(path.join(raiz, 'evidencias', 'trazas', t.caso_id + '.json'), JSON.stringify(t, null, 2) + '\n');
    });
  }
  console.log('✓ publico.json: ' + publico.casos.length + ' casos · costos_operacion.csv: ' + (exp.costos || []).length + ' filas · trazas: ' + trazas.length);
})();
