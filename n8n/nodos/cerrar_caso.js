// Nodo Code «Cerrar caso» — persiste el cierre, arma la notificación al solicitante y la solicitud de aprobación humana.
// Salida: un ítem por mensaje. tipo 0 = texto · tipo 1 = con botones de aprobación
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const C = NUCLEO.CONFIG;
const exec = String($execution.id);
const act = st.activos[exec];
if (!act || !st.casos[act.caso_id]) return [];
const caso = st.casos[act.caso_id];
delete st.activos[exec];
if (caso.fase !== 'fin') NUCLEO.cerrar(caso, 'error', 'cierre_sin_fin');
NUCLEO.trazar(caso, 'orquestador', 'registro_y_notificacion', { estado: caso.estado, costo_usd: caso.costo_usd, llamadas: caso.llamadas });

const salidas = [];
const solicitante = st._privado[caso.caso_id] && st._privado[caso.caso_id].chat_id;
if (solicitante) salidas.push({ json: { tipo: 0, chat_id: solicitante, texto: NUCLEO.mensajeCierre(caso) } });

if (caso.estado === 'pendiente_aprobacion' && C.chat_aprobador) {
  const v = caso.aprobacion.version;
  const texto = '🔐 APROBACIÓN REQUERIDA (operación SIMULADA)\n' + NUCLEO.resumenCaso(caso) +
    '\nCanal de origen: ' + caso.canal + ' · Versión: v' + v + ' · Vence: ' + caso.aprobacion.expira +
    '\nAcción a autorizar: apartar inventario de prueba para ' + caso.requerimiento.fecha_evento + '.' +
    '\nAlternativa por comando: /aprobar ' + caso.caso_id + ' ' + v + '  ·  /rechazar ' + caso.caso_id + ' ' + v;
  salidas.push({ json: { tipo: 1, chat_id: C.chat_aprobador, texto,
    botones: { aprobar: 'ap|' + caso.caso_id + '|' + v, rechazar: 're|' + caso.caso_id + '|' + v } } });
} else if (!solicitante && C.chat_aprobador) {
  salidas.push({ json: { tipo: 0, chat_id: C.chat_aprobador, texto: '📞 Caso creado por voz terminó sin aprobación pendiente.\n' + NUCLEO.resumenCaso(caso) } });
}
return salidas;
