// Nodo Code «Entrada Telegram» — única entrada del bot. Valida usuario, deduplica, enruta comandos y aplica guardrails de entrada.
// Salidas (campo salida): 0 = ignorar · 1 = mensaje a Telegram · 2 = procesar caso
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const C = NUCLEO.CONFIG;
const u = $input.first().json;
const msg = (chat_id, texto, botones) => ({ json: { salida: 1, tipo: botones ? 1 : 0, chat_id, texto, botones: botones || null } });
const ignorar = (motivo) => [{ json: { salida: 0, motivo } }];
const FOLIO = /^EVT-\d{6}-\d{4}$/;

// Limpieza de ejecuciones activas huérfanas (> 1 h)
Object.keys(st.activos).forEach((k) => { if (Date.now() - Date.parse(st.activos[k].creado || 0) > 3600000) delete st.activos[k]; });

// 1) Deduplicación persistente por update_id
if (u.update_id != null && NUCLEO.yaProcesado(st, 'tg:' + u.update_id)) {
  NUCLEO.bitacora(st, 'evento_duplicado', { update_id: u.update_id });
  return ignorar('duplicado');
}
const cb = u.callback_query;
const m = u.message;
const from = cb ? cb.from : (m && m.from);
const chatId = cb ? (cb.message && cb.message.chat && cb.message.chat.id) : (m && m.chat && m.chat.id);
if (!from || chatId == null) return ignorar('sin_remitente');

// 2) Control de acceso (servidor): solo IDs autorizados en config.local.json
const esAprobador = C.aprobadores.map(String).includes(String(from.id));
const autorizado = esAprobador || C.usuarios_autorizados.map(String).includes(String(from.id));
if (!autorizado) {
  NUCLEO.bitacora(st, 'usuario_no_autorizado', { usuario: NUCLEO.seudonimo('telegram', from.id) });
  return [msg(chatId, '⛔ Este bot de prueba solo atiende a usuarios autorizados. Tu solicitud no se procesó.')];
}

// 3) Botones de aprobación: data = ap|FOLIO|version  o  re|FOLIO|version
if (cb) {
  const [acc, folio, ver] = String(cb.data || '').split('|');
  if (!['ap', 're'].includes(acc) || !FOLIO.test(folio || '')) return [msg(chatId, 'Acción no reconocida.')];
  const r = NUCLEO.decidirAprobacion(st, { folio, version: ver, decision: acc === 'ap' ? 'aprobar' : 'rechazar', aprobador_id: from.id });
  if (r.caso) NUCLEO.trazar(r.caso, 'aprobador_humano', 'decision_telegram', { decision: acc, version: ver, resultado: r.codigo || 'ok', via: 'boton' });
  const salidas = [msg(chatId, r.mensaje)];
  const solicitante = r.caso && st._privado && st._privado[folio] && st._privado[folio].chat_id;
  if (r.ok && solicitante && String(solicitante) !== String(chatId)) salidas.push(msg(solicitante, NUCLEO.resumenCaso(r.caso)));
  return salidas;
}

// 4) Mensajes de texto
const texto = String((m && m.text) || '').trim();
if (!texto) return [msg(chatId, 'Solo acepto mensajes de texto. Escribe /ayuda.')];
if (texto.length > C.longitud_max_entrada) return [msg(chatId, '⚠️ Mensaje demasiado largo (' + texto.length + ' caracteres; máximo ' + C.longitud_max_entrada + '). Resume tu solicitud.')];
const partes = texto.split(/\s+/);
const cmd = partes[0].toLowerCase().replace(/@\w+$/, '');
const AYUDA = 'Eventia · Cotizador de mobiliario (empresa ficticia, RESULTADO SIMULADO)\n\n' +
  '/nuevo <descripción del evento> — crea un caso y devuelve folio\n   Ej.: /nuevo boda el 2026-12-05, 120 invitados, zona norte, sillas tiffany y 12 mesas redondas\n' +
  '/estado FOLIO — consulta el estado\n/costo FOLIO — costo y llamadas del caso\n' +
  (esAprobador ? '/aprobar FOLIO VERSION · /rechazar FOLIO VERSION — decisión humana\n' : '') +
  'Zonas: centro, norte, sur, oriente.';

if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help') return [msg(chatId, AYUDA)];

if (cmd === '/estado' || cmd === '/costo') {
  const folio = (partes[1] || '').toUpperCase();
  if (!FOLIO.test(folio)) return [msg(chatId, 'Indica un folio válido. Ej.: ' + cmd + ' EVT-261105-0001')];
  const c = st.casos[folio];
  if (!c || (!esAprobador && c.usuario !== NUCLEO.seudonimo('telegram', from.id))) return [msg(chatId, 'No encontré el folio ' + folio + ' entre tus casos.')];
  if (cmd === '/estado') return [msg(chatId, NUCLEO.resumenCaso(c))];
  const filas = st.llamadas.filter((l) => l.caso_id === folio && l.origen === 'medido');
  return [msg(chatId, 'Costo del caso ' + folio + ': ' + c.costo_usd.toFixed(6) + ' USD (límite ' + c.limite_costo_usd + ' USD)\n' +
    filas.map((l) => l.llamada_id + ' · ' + l.agente + ' · ' + l.tokens_entrada + '/' + l.tokens_salida + ' tok · ' + l.costo_usd + ' USD').join('\n'))];
}

if (cmd === '/aprobar' || cmd === '/rechazar') {
  const folio = (partes[1] || '').toUpperCase();
  const ver = String(partes[2] || '').replace(/^v/i, '');
  if (!FOLIO.test(folio) || !/^\d+$/.test(ver)) return [msg(chatId, 'Formato: ' + cmd + ' FOLIO VERSION. Ej.: ' + cmd + ' EVT-261105-0001 2')];
  const r = NUCLEO.decidirAprobacion(st, { folio, version: ver, decision: cmd === '/aprobar' ? 'aprobar' : 'rechazar', aprobador_id: from.id });
  if (r.caso) NUCLEO.trazar(r.caso, 'aprobador_humano', 'decision_telegram', { decision: cmd, version: ver, resultado: r.codigo || 'ok', via: 'comando' });
  const salidas = [msg(chatId, r.mensaje)];
  const solicitante = r.caso && st._privado[folio] && st._privado[folio].chat_id;
  if (r.ok && solicitante && String(solicitante) !== String(chatId)) salidas.push(msg(solicitante, NUCLEO.resumenCaso(r.caso)));
  return salidas;
}

if (cmd === '/nuevo') {
  let resto = partes.slice(1);
  const opciones = {};
  while (resto.length && /^(limite|skill)=/.test(resto[0])) { const [k, v] = resto.shift().split('='); opciones[k] = v; }
  const descripcion = resto.join(' ');
  if (descripcion.length < 10) return [msg(chatId, 'Describe el evento después de /nuevo (fecha, invitados, zona y artículos).\nEj.: /nuevo boda el 2026-12-05, 120 invitados, zona norte, sillas tiffany')];
  const skill = ['1.0', '1.1'].includes(opciones.skill) ? opciones.skill : undefined;   // 1.0 solo reproduce la prueba V1→V2
  const caso = NUCLEO.crearCaso(st, { canal: 'telegram', usuario_id: from.id, chat_id: chatId, texto: descripcion, limite_usd: opciones.limite, skill_cotizacion: skill });
  // Guardrail de inyección: se bloquea antes de enviar cualquier texto al modelo
  const iny = NUCLEO.detectarInyeccion(descripcion);
  if (iny.bloqueado) {
    NUCLEO.trazar(caso, 'guardrail_entrada', 'inyeccion_bloqueada', { patron: iny.patron });
    NUCLEO.cerrar(caso, 'bloqueado', 'instrucción no permitida detectada en la entrada');
    return [msg(chatId, '🛡️ Folio ' + caso.caso_id + ': la solicitud contiene instrucciones no permitidas (p. ej. ignorar reglas o pedir secretos). No se procesó y no se llamó al modelo.')];
  }
  st.activos[String($execution.id)] = { caso_id: caso.caso_id, creado: new Date().toISOString() };
  return [
    msg(chatId, '📥 Recibí tu solicitud. Folio: ' + caso.caso_id + '\nLa están procesando 4 agentes (intake → catálogo → propuesta → revisión). Te aviso al terminar.'),
    { json: { salida: 2, caso_id: caso.caso_id, skills_url: C.skills_url } }
  ];
}

return [msg(chatId, 'No reconocí el comando. ' + AYUDA)];
