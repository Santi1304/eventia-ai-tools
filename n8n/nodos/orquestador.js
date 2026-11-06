// Nodo Code «Orquestador» — decide qué agente invocar, controla presupuesto/iteraciones y cuándo terminar.
// Entra desde «Cargar skills» (primera vez) o desde «Registrar llamada» (cada vuelta del loop).
// Salidas: 0 = nada · 1 = llamar al modelo · 2 = cerrar caso
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const exec = String($execution.id);
const act = st.activos[exec];
if (!act || !st.casos[act.caso_id]) return [{ json: { salida: 0, error: 'sin_caso_activo' } }];
const caso = st.casos[act.caso_id];

if (!act.skills) {   // Adaptador de skills: carga, verifica hash y versión; falla cerrada si no puede.
  const j = $input.first().json;
  let body = j.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { /* inválido */ } }
  const res = j.statusCode === 200 ? NUCLEO.cargarSkills(body, caso) : { ok: false, error: 'http_' + (j.statusCode || (j.error ? 'red' : 'desconocido')) };
  if (!res.ok) {
    NUCLEO.trazar(caso, 'orquestador', 'skills_no_cargados', { error: res.error });
    NUCLEO.cerrar(caso, 'error', 'skills_no_disponibles: ' + res.error);
    return [{ json: { salida: 2, caso_id: caso.caso_id } }];
  }
  act.skills = res.skills;
  NUCLEO.trazar(caso, 'orquestador', 'skills_cargados', {
    cotizacion: res.skills.cotizacion.nombre + '@' + res.skills.cotizacion.version + ' #' + res.skills.cotizacion.hash,
    revision: res.skills.revision.nombre + '@' + res.skills.revision.version + ' #' + res.skills.revision.hash,
    reglas_cotizacion: res.skills.cotizacion.reglas.length, criterios_revision: res.skills.revision.criterios.length
  });
}

const paso = NUCLEO.orquestar(st, caso, act.skills);
if (paso.accion === 'llamar') return [{ json: { salida: 1, caso_id: caso.caso_id, agente: paso.agente, request: paso.solicitud } }];
return [{ json: { salida: 2, caso_id: caso.caso_id } }];
