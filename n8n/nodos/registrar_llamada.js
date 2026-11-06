// Nodo Code «Registrar llamada» — loop de seguridad y costo: registra uso medido, aplica la salida del agente y vuelve al orquestador.
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const act = st.activos[String($execution.id)];
if (!act || !st.casos[act.caso_id]) return [{ json: { salida: 0, error: 'sin_caso_activo' } }];
const caso = st.casos[act.caso_id];
NUCLEO.aplicarRespuesta(st, caso, $input.first().json);
return [{ json: { caso_id: caso.caso_id, estado: caso.estado, fase: caso.fase, costo_usd: caso.costo_usd } }];
