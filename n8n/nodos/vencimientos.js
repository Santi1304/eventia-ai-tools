// Nodo Code «Vencimientos» — tarea programada (cada 10 min): vence aprobaciones sin decisión y avisa.
const st = NUCLEO.iniciarAlmacen($getWorkflowStaticData('global'));
const C = NUCLEO.CONFIG;
const vencidos = NUCLEO.barrerVencimientos(st);
const salidas = [];
vencidos.forEach((c) => {
  const chat = st._privado[c.caso_id] && st._privado[c.caso_id].chat_id;
  const texto = '⌛ ' + c.caso_id + ': la aprobación venció sin decisión. No se apartó inventario.\n' + NUCLEO.resumenCaso(c);
  if (chat) salidas.push({ json: { tipo: 0, chat_id: chat, texto } });
  if (C.chat_aprobador && String(C.chat_aprobador) !== String(chat)) salidas.push({ json: { tipo: 0, chat_id: C.chat_aprobador, texto } });
});
NUCLEO.bitacora(st, 'barrido_vencimientos', { vencidos: vencidos.length });
return salidas;
