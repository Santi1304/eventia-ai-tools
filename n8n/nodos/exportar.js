// Nodo Code «Exportar» — devuelve la exportación sanitizada para el panel público y el registro de costos.
// Protegido con autenticación por encabezado. ?folio=EVT-... devuelve además la traza sanitizada de ese caso.
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const q = ($input.first().json.query) || {};
const out = { publico: NUCLEO.exportarPublico(st), costos: st.llamadas,
  bitacora: st.bitacora.map((e) => ({ fecha_hora: e.fecha_hora, tipo: e.tipo })) };
if (q.folio && st.casos[String(q.folio).toUpperCase()]) out.traza = NUCLEO.trazaSanitizada(st.casos[String(q.folio).toUpperCase()]);
if (q.todas === '1') out.trazas = Object.values(st.casos).map(NUCLEO.trazaSanitizada);
return [{ json: { respuesta: out } }];
