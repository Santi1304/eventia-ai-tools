#!/usr/bin/env node
// Genera el workflow de n8n incrustando agentes/nucleo.js, el catálogo y la configuración en cada nodo Code.
//   node scripts/build_n8n.js            → n8n/eventia_workflow.json        (exportable, SIN IDs ni URLs personales)
//   node scripts/build_n8n.js --local    → n8n/eventia_workflow.local.json  (usa n8n/config.local.json; NO se sube al repo)
// Las credenciales (bot, API key, encabezados de webhook) nunca están en el JSON: se vinculan en n8n tras importar.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.join(__dirname, '..');
const leer = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const local = process.argv.includes('--local');
const configPublica = JSON.parse(leer('n8n/config.ejemplo.json'));
const config = local ? JSON.parse(leer('n8n/config.local.json')) : configPublica;
delete config._instrucciones;

const nucleo = leer('agentes/nucleo.js').replace(/\nif \(typeof module[^\n]*\n?/, '\n');
const catalogo = JSON.parse(leer('datos/catalogo.json'));
const semilla = JSON.parse(leer('datos/reservas_semilla.json'));

function codigoNodo(archivo, cfg) {
  const encabezado = '// GENERADO por scripts/build_n8n.js — no editar aquí; editar agentes/nucleo.js o n8n/nodos/' + archivo + '\n' +
    'const __CONFIG = ' + JSON.stringify(cfg || config) + ';\n' +
    'const __CATALOGO = ' + JSON.stringify(catalogo) + ';\n' +
    'const __SEMILLA = ' + JSON.stringify(semilla) + ';\n';
  return encabezado + nucleo + '\n// ── nodo ──\n' + leer('n8n/nodos/' + archivo);
}

const uid = (s) => crypto.createHash('md5').update('eventia|' + s).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5');
const cred = (tipo, nombre) => ({ [tipo]: { id: 'VINCULAR', name: nombre } });
const nodos = [];
const nodo = (name, type, typeVersion, position, parameters, extra) => { nodos.push(Object.assign({ id: uid(name), name, type, typeVersion, position, parameters }, extra || {})); };
const code = (name, archivo, pos) => nodo(name, 'n8n-nodes-base.code', 2, pos, { jsCode: codigoNodo(archivo) });
const sw = (name, n, pos) => nodo(name, 'n8n-nodes-base.switch', 3.2, pos, { mode: 'expression', numberOutputs: n, output: '={{ $json.salida }}' });

// ── Canal Telegram ──
nodo('Telegram Trigger', 'n8n-nodes-base.telegramTrigger', 1.2, [0, 300], { updates: ['message', 'callback_query'], additionalFields: {} },
  { webhookId: uid('tg-webhook'), credentials: cred('telegramApi', 'Eventia Bot (Telegram)') });
code('Entrada Telegram', 'entrada_telegram.js', [220, 300]);
sw('Ruta', 3, [440, 300]);

// ── Ecosistema agéntico ──
nodo('Cargar skills', 'n8n-nodes-base.httpRequest', 4.2, [680, 420], {
  url: '={{ $json.skills_url }}',
  options: { timeout: 10000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } }
}, { onError: 'continueRegularOutput' });
code('Orquestador', 'orquestador.js', [900, 420]);
sw('Siguiente', 3, [1120, 420]);
nodo('Claude API', 'n8n-nodes-base.httpRequest', 4.2, [1340, 340], {
  method: 'POST',
  url: '={{ $json.request.url }}',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpHeaderAuth',
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }, { name: 'content-type', value: 'application/json' }] },
  sendBody: true,
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json.request.body) }}',
  options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } }
}, { onError: 'continueRegularOutput', credentials: cred('httpHeaderAuth', 'Anthropic API Key (x-api-key)') });
code('Registrar llamada', 'registrar_llamada.js', [1560, 340]);
code('Cerrar caso', 'cerrar_caso.js', [1340, 540]);

// ── Mensajería ──
sw('Tipo de mensaje', 2, [1580, 640]);
nodos[nodos.length - 1].parameters.output = '={{ $json.tipo }}';
nodo('Enviar Telegram', 'n8n-nodes-base.telegram', 1.2, [1800, 580],
  { chatId: '={{ $json.chat_id }}', text: '={{ $json.texto }}', additionalFields: { appendAttribution: false } },
  { credentials: cred('telegramApi', 'Eventia Bot (Telegram)') });
nodo('Enviar aprobación', 'n8n-nodes-base.telegram', 1.2, [1800, 740], {
  chatId: '={{ $json.chat_id }}', text: '={{ $json.texto }}', replyMarkup: 'inlineKeyboard',
  inlineKeyboard: { rows: [{ row: { buttons: [
    { text: '✅ Aprobar', additionalFields: { callback_data: '={{ $json.botones.aprobar }}' } },
    { text: '❌ Rechazar', additionalFields: { callback_data: '={{ $json.botones.rechazar }}' } }
  ] } }] },
  additionalFields: { appendAttribution: false }
}, { credentials: cred('telegramApi', 'Eventia Bot (Telegram)') });

// ── Canal de voz (herramienta de servidor de ElevenLabs) ──
nodo('Webhook voz', 'n8n-nodes-base.webhook', 2, [0, 620], { httpMethod: 'POST', path: 'eventia-voz', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
  { webhookId: uid('voz-webhook'), credentials: cred('httpHeaderAuth', 'Eventia Voz (encabezado)') });
code('Entrada voz', 'entrada_voz.js', [220, 620]);
nodo('Responder voz', 'n8n-nodes-base.respondToWebhook', 1.1, [440, 620], { respondWith: 'json', responseBody: '={{ JSON.stringify($json.respuesta) }}', options: {} });

// ── Exportación sanitizada para el panel (GitHub Actions / script) ──
nodo('Webhook export', 'n8n-nodes-base.webhook', 2, [0, 860], { httpMethod: 'GET', path: 'eventia-export', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
  { webhookId: uid('export-webhook'), credentials: cred('httpHeaderAuth', 'Eventia Export (encabezado)') });
code('Exportar', 'exportar.js', [220, 860]);
nodo('Responder export', 'n8n-nodes-base.respondToWebhook', 1.1, [440, 860], { respondWith: 'json', responseBody: '={{ JSON.stringify($json.respuesta) }}', options: {} });

// ── Tarea programada ──
nodo('Programado: vencimientos', 'n8n-nodes-base.scheduleTrigger', 1.2, [1120, 760], { rule: { interval: [{ field: 'minutes', minutesInterval: 10 }] } });
code('Vencimientos', 'vencimientos.js', [1340, 760]);

const C = (pairs) => ({ main: pairs.map((salida) => (salida || []).map((n) => ({ node: n, type: 'main', index: 0 }))) });
const connections = {
  'Telegram Trigger': C([['Entrada Telegram']]),
  'Entrada Telegram': C([['Ruta']]),
  'Ruta': C([[], ['Tipo de mensaje'], ['Cargar skills']]),
  'Cargar skills': C([['Orquestador']]),
  'Orquestador': C([['Siguiente']]),
  'Siguiente': C([[], ['Claude API'], ['Cerrar caso']]),
  'Claude API': C([['Registrar llamada']]),
  'Registrar llamada': C([['Orquestador']]),
  'Cerrar caso': C([['Tipo de mensaje']]),
  'Tipo de mensaje': C([['Enviar Telegram'], ['Enviar aprobación']]),
  'Webhook voz': C([['Entrada voz']]),
  'Entrada voz': C([['Responder voz']]),
  'Responder voz': C([['Ruta']]),
  'Webhook export': C([['Exportar']]),
  'Exportar': C([['Responder export']]),
  'Programado: vencimientos': C([['Vencimientos']]),
  'Vencimientos': C([['Tipo de mensaje']])
};

const workflow = {
  name: 'Eventia · Cotizador de mobiliario (SIMULADO)',
  nodes: nodos,
  connections,
  settings: { executionOrder: 'v1', saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all' },
  pinData: {},
  meta: { generado_por: 'scripts/build_n8n.js', nucleo_hash: crypto.createHash('sha256').update(nucleo).digest('hex').slice(0, 16) }
};
if (require.main === module) {
  const destino = path.join(raiz, 'n8n', local ? 'eventia_workflow.local.json' : 'eventia_workflow.json');
  fs.writeFileSync(destino, JSON.stringify(workflow, null, 2) + '\n');
  console.log('✓ ' + path.relative(raiz, destino) + ' · ' + nodos.length + ' nodos · núcleo ' + workflow.meta.nucleo_hash);
}
module.exports = { codigoNodo, workflow };
