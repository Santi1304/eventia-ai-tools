// Nodo Code «Entrada voz» — receptor de la herramienta de servidor de ElevenLabs (webhook con autenticación por encabezado).
// Canal público: solo datos ficticios. Acciones: consultar (folio) y crear (datos estructurados del evento).
// Salidas: 0 = solo responder · 2 = responder y procesar el caso
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const C = NUCLEO.CONFIG;
st.voz = st.voz || {};
const b = ($input.first().json.body) || {};
const responder = (codigo, respuesta, salida) => [{ json: { salida: salida || 0, codigo, respuesta: Object.assign({ modo: 'RESULTADO SIMULADO' }, respuesta) } }];
const FOLIO = /^EVT-\d{6}-\d{4}$/;
const texto = (v, n) => (v == null ? null : String(v).slice(0, n));

if (!['consultar', 'crear'].includes(b.accion)) return responder(400, { ok: false, mensaje: 'Acción no permitida. Usa consultar o crear.' });

if (b.accion === 'consultar') {
  const folio = String(b.folio || '').toUpperCase().replace(/\s+/g, '');
  if (!FOLIO.test(folio)) return responder(200, { ok: false, mensaje: 'El folio debe tener el formato EVT, seis dígitos de fecha y cuatro dígitos. Pide al usuario que lo repita.' });
  const c = st.casos[folio];
  if (!c) return responder(200, { ok: false, folio, mensaje: 'No existe un caso con ese folio en el sistema de prueba.' });
  NUCLEO.trazar(c, 'canal_voz', 'consulta_estado', { conversacion: NUCLEO.hash(String(b.conversacion_id || '')) });
  return responder(200, { ok: true, folio, estado: c.estado, estado_legible: NUCLEO.ETIQUETAS[c.estado] || c.estado,
    tipo_evento: c.requerimiento ? c.requerimiento.tipo_evento : null, fecha_evento: c.requerimiento ? c.requerimiento.fecha_evento : null,
    invitados: c.requerimiento ? c.requerimiento.invitados : null, total_mxn: c.cotizacion ? c.cotizacion.total : null,
    version_propuesta: c.version_propuesta, actualizado: c.actualizado });
}

// crear — idempotente por evento_id (o por huella del contenido en la misma conversación)
const evento = texto(b.evento_id, 80) || NUCLEO.hash(JSON.stringify(b) + '|' + String(b.conversacion_id || ''));
if (st.voz[evento]) return responder(200, { ok: true, folio: st.voz[evento], duplicado: true, mensaje: 'Esa solicitud ya estaba registrada con el folio ' + st.voz[evento] + '.' });

const datos = {
  fecha_evento: texto(b.fecha_evento, 10), invitados: b.invitados == null ? null : Number(b.invitados), zona: texto(b.zona, 20),
  tipo_evento: texto(b.tipo_evento, 60), dias_renta: b.dias_renta == null ? null : Number(b.dias_renta),
  articulos: b.articulos_texto ? [{ descripcion: texto(b.articulos_texto, 200), cantidad: null }] : []
};
const libre = [datos.tipo_evento, b.articulos_texto].filter(Boolean).join(' ');
if (libre.length > C.longitud_max_entrada) return responder(400, { ok: false, mensaje: 'Datos demasiado largos.' });
const caso = NUCLEO.crearCaso(st, { canal: 'voz', usuario_id: String(b.conversacion_id || evento), chat_id: null, texto: libre, datos });
st.voz[evento] = caso.caso_id;
const iny = NUCLEO.detectarInyeccion(libre);
if (iny.bloqueado) {
  NUCLEO.trazar(caso, 'guardrail_entrada', 'inyeccion_bloqueada', { patron: iny.patron });
  NUCLEO.cerrar(caso, 'bloqueado', 'instrucción no permitida detectada en la entrada de voz');
  return responder(200, { ok: false, folio: caso.caso_id, mensaje: 'La solicitud contiene instrucciones no permitidas y no se procesó.' });
}
st.activos[String($execution.id)] = { caso_id: caso.caso_id, creado: new Date().toISOString() };
return [{ json: { salida: 2, codigo: 200, skills_url: C.skills_url, caso_id: caso.caso_id,
  respuesta: { ok: true, folio: caso.caso_id, modo: 'RESULTADO SIMULADO',
    mensaje: 'Solicitud registrada con folio ' + caso.caso_id + '. Los agentes la están cotizando; un aprobador humano la revisa por Telegram. Puede consultar el estado con el folio en un minuto.' } } }];
