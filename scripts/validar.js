#!/usr/bin/env node
// Controles previos a la publicación (GitHub Actions). Cualquier falla devuelve código 1 y bloquea el despliegue.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const raiz = path.join(__dirname, '..');
const N = require('../agentes/nucleo.js');
const fallas = [];
const ok = (m) => console.log('✓ ' + m);
const falla = (m) => { fallas.push(m); console.error('✗ ' + m); };
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const existe = (p) => fs.existsSync(path.join(raiz, p));

// 1. Archivos obligatorios
['README.md', '.env.example', 'web/index.html', 'web/datos/publico.json', 'web/skills/bundle.json', 'datos/catalogo.json', 'n8n/eventia_workflow.json',
  'skills/cotizacion-mobiliario-eventos/SKILL.md', 'skills/revision-propuesta-eventos/SKILL.md', 'costos/tarifas.csv', 'tests/pruebas.csv', 'agentes/contratos.md']
  .forEach((p) => (existe(p) ? null : falla('Falta archivo obligatorio: ' + p)));
ok('archivos obligatorios revisados');

// 2. Catálogo: estructura y reglas
const cat = JSON.parse(leer('datos/catalogo.json'));
const skus = new Set();
cat.articulos.forEach((a) => {
  if (skus.has(a.sku)) falla('SKU duplicado ' + a.sku); skus.add(a.sku);
  if (!(a.precio_dia > 0)) falla('Precio inválido en ' + a.sku);
  if (!Number.isInteger(a.stock) || a.stock < 0) falla('Stock inválido en ' + a.sku);
});
if (!(cat.politicas.iva > 0 && cat.politicas.iva < 1)) falla('IVA fuera de rango');
ok('catálogo validado (' + cat.articulos.length + ' artículos)');

// 3. Cálculo determinista de referencia (si cambian reglas o precios sin actualizar esta prueba, falla)
const ref = N.calcularCotizacion({ zona: 'norte', dias_renta: 1 }, [{ sku: 'SIL-TIF', nombre: 'Silla tiffany', cantidad: 120, precio_dia: 35 }, { sku: 'MES-RED', nombre: 'Mesa', cantidad: 12, precio_dia: 90 }]);
if (ref.total !== 7052.8) falla('Cálculo de referencia esperado 7052.80, obtenido ' + ref.total);
const ref2 = N.calcularCotizacion({ zona: 'centro', dias_renta: 3 }, [{ sku: 'SIL-TIF', nombre: 'Silla tiffany', cantidad: 300, precio_dia: 35 }]);
if (ref2.descuento_pct !== 0.08 || ref2.total !== 34312.8) falla('Cálculo con descuento esperado 34312.80 (8 %), obtenido ' + ref2.total + ' (' + ref2.descuento_pct + ')');
ok('cálculos deterministas de referencia');

// 4. Skills: bundle publicado = archivos fuente
try { execSync('node scripts/build_skills.js --check', { cwd: raiz, stdio: 'pipe' }); ok('bundle de skills coincide con skills/'); }
catch (e) { falla('El bundle de skills no coincide con skills/ (ejecuta node scripts/build_skills.js)'); }

// 5. Workflow n8n: generado desde el núcleo actual y sin IDs ni secretos
const wf = JSON.parse(leer('n8n/eventia_workflow.json'));
const { workflow: esperado } = require('./build_n8n.js');
if (JSON.stringify(wf.nodes.map((n) => n.parameters)) !== JSON.stringify(esperado.nodes.map((n) => n.parameters))) falla('n8n/eventia_workflow.json desactualizado (ejecuta node scripts/build_n8n.js)');
const cfgPublica = JSON.parse(leer('n8n/config.ejemplo.json'));
if (cfgPublica.usuarios_autorizados.length || cfgPublica.aprobadores.length || cfgPublica.chat_aprobador) falla('config.ejemplo.json contiene IDs de Telegram');
wf.nodes.forEach((n) => { if (n.credentials) Object.values(n.credentials).forEach((c) => { if (c.id !== 'VINCULAR') falla('Credencial con id real en nodo ' + n.name); }); });
ok('workflow n8n sincronizado y sin IDs de credenciales');

// 6. Datos públicos: esquema, privacidad y conciliación
const pub = JSON.parse(leer('web/datos/publico.json'));
['generado', 'kpi', 'por_estado', 'casos', 'datos_ficticios'].forEach((k) => (k in pub ? null : falla('publico.json sin campo ' + k)));
if (pub.datos_ficticios !== true) falla('publico.json debe declarar datos_ficticios: true');
if (/"(chat_id|_privado|telefono|email|username|first_name)"\s*:/.test(leer('web/datos/publico.json'))) falla('publico.json contiene campos privados');
if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(leer('web/datos/publico.json'))) falla('publico.json contiene un correo electrónico');
const sumaEstados = Object.values(pub.por_estado || {}).reduce((a, b) => a + b, 0);
if (sumaEstados !== (pub.casos || []).length) falla('por_estado (' + sumaEstados + ') no concilia con casos (' + pub.casos.length + ')');
const liberados = (pub.casos || []).filter((c) => ['pendiente_aprobacion', 'aprobado_simulado', 'rechazado', 'vencido'].includes(c.estado) && c.versiones > 0);
const k = pub.kpi.costo_promedio_caso_completado_usd;
if (k.valor != null && liberados.length) {
  const esperadoK = liberados.reduce((a, c) => a + c.costo_usd, 0) / liberados.length;
  if (Math.abs(esperadoK - k.valor) > 1e-6) falla('KPI de costo promedio no concilia: ' + k.valor + ' vs ' + esperadoK.toFixed(6));
}
(pub.casos || []).forEach((c) => { if (!/^EVT-\d{6}-\d{4}$/.test(c.folio)) falla('Folio inválido en publico.json: ' + c.folio); });
ok('datos públicos validados (' + (pub.casos || []).length + ' casos)');

// 7. Costos: columnas obligatorias
if (existe('costos/costos_operacion.csv')) {
  const cab = leer('costos/costos_operacion.csv').split('\n')[0].split(',');
  ['fecha_hora', 'caso_id', 'llamada_id', 'etapa', 'agente', 'proveedor', 'modelo', 'tokens_entrada', 'tokens_salida', 'costo_usd', 'moneda', 'estado', 'reintento', 'origen']
    .forEach((c) => (cab.includes(c) ? null : falla('costos_operacion.csv sin columna ' + c)));
  ok('registro de costos con columnas obligatorias');
}

// 8. Escaneo de secretos en todo lo que se versiona o publica
const PATRONES = [[/sk-ant-[A-Za-z0-9_-]{10,}/, 'API key de Anthropic'], [/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/, 'token de bot de Telegram'], [/ghp_[A-Za-z0-9]{20,}/, 'token de GitHub'],
  [/xi-api-key\s*[:=]\s*['"]?[A-Za-z0-9]{20,}/i, 'API key de ElevenLabs'], [/sk_[a-f0-9]{40,}/, 'API key de ElevenLabs']];
const ignorar = new Set(['.git', 'node_modules', '_site']);
(function recorrer(dir) {
  fs.readdirSync(dir).forEach((f) => {
    if (ignorar.has(f)) return;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) return recorrer(p);
    if (/\.(png|jpg|jpeg|gif|pdf|zip|mp4|webm)$/i.test(f) || f.endsWith('.local.json') || f === '.env') return;
    const t = fs.readFileSync(p, 'utf8');
    PATRONES.forEach(([re, nombre]) => { if (re.test(t)) falla('Posible ' + nombre + ' en ' + path.relative(raiz, p)); });
  });
})(raiz);
ok('escaneo de secretos');

// 9. HTML: requisitos mínimos de accesibilidad y seguridad
const html = leer('web/index.html');
if (!/<html lang="es">/.test(html)) falla('index.html sin lang="es"');
if (!/name="viewport"/.test(html)) falla('index.html sin viewport');
if (/xi-api-key|api[_-]?key\s*[:=]/i.test(html)) falla('index.html contiene una API key');
if (!/Datos ficticios/i.test(html)) falla('index.html sin rótulo de datos ficticios');
ok('HTML con requisitos mínimos');

if (fallas.length) { console.error('\n' + fallas.length + ' control(es) fallaron. NO se publica.'); process.exit(1); }
console.log('\nTodos los controles pasaron.');
