// Simulador mínimo de n8n para pruebas automáticas de lógica (CI).
// Ejecuta los nodos Code EXACTOS del workflow generado y respeta sus conexiones y switches.
// El modelo y Telegram son DOBLES DE PRUEBA: sus tokens y textos NO son evidencia de operación real.
const fs = require('fs');
const path = require('path');
const { workflow: wfBase, codigoNodo } = require('../scripts/build_n8n.js');

// Configuración de prueba: IDs ficticios (111 = solicitante, 999 = aprobador). Nunca IDs reales.
const CONFIG_PRUEBA = { skills_url: 'https://prueba.invalid/skills/bundle.json', usuarios_autorizados: [111], aprobadores: [999], chat_aprobador: 999, limite_costo_usd: 0.02, skill_cotizacion_version: '1.1' };
const workflow = JSON.parse(JSON.stringify(wfBase));
workflow.nodes.forEach((n) => {
  if (n.type.endsWith('.code')) n.parameters.jsCode = codigoNodo(/n8n\/nodos\/(\w+\.js)/.exec(n.parameters.jsCode)[1], CONFIG_PRUEBA);
});

const bundle = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'skills', 'bundle.json'), 'utf8'));
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

// ── Doble del modelo: respuestas deterministas según el agente ──
function modeloFalso(body, opciones) {
  const sys = body.system, user = body.messages[0].content;
  const uso = (txt) => ({ input_tokens: Math.ceil((sys.length + user.length) / 3.5), output_tokens: Math.ceil(txt.length / 3.5), cache_read_input_tokens: 0, cache_creation_input_tokens: 0 });
  const ok = (txt) => ({ statusCode: 200, body: { id: 'msg_falso', model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: txt }], usage: uso(txt) } });
  if (opciones.caida) return { statusCode: 529, body: { type: 'error', error: { type: 'overloaded_error' } } };
  if (sys.includes('Agente 1')) {
    const t = user;
    const fecha = (/(\d{4}-\d{2}-\d{2})/.exec(t) || [])[1] || null;
    const inv = (/(\d+)\s+invitados/.exec(t) || [])[1];
    const zona = (/zona\s+(\w+)/i.exec(t) || [])[1] || null;
    const tipo = (/(boda|xv años|cumpleaños|bautizo|graduación|corporativo|fiesta)/i.exec(t) || [])[1] || null;
    const articulos = [];
    const re = /(?:(\d+)\s+)?(sillas? tiffany|sillas? plegables?|mesas? redondas?|mesas? tabl[oó]n|carpas?|pista de baile|calentadores?|luces)/gi;
    let m; while ((m = re.exec(t))) articulos.push({ descripcion: m[2], cantidad: m[1] ? Number(m[1]) : null });
    return ok(JSON.stringify({ fecha_evento: fecha, invitados: inv ? Number(inv) : null, tipo_evento: tipo, zona, dias_renta: null, articulos, notas: null }));
  }
  if (sys.includes('Agente 2')) {
    const arts = JSON.parse(user.replace(/<\/?datos_usuario>/g, ''));
    const mapa = [[/tiffany/i, 'SIL-TIF'], [/plegable/i, 'SIL-PLE'], [/redonda/i, 'MES-RED'], [/tabl/i, 'MES-TAB'], [/carpa/i, 'CAR-612'], [/pista/i, 'PIS-44'], [/calentador/i, 'CAL-EXT'], [/luces/i, 'ILU-SER']];
    const lineas = [], no = [];
    arts.forEach((a) => { const h = mapa.find(([r]) => r.test(a.descripcion)); if (h) lineas.push({ sku: h[1], cantidad: a.cantidad, descripcion_original: a.descripcion }); else no.push(a.descripcion); });
    return ok(JSON.stringify({ lineas, no_mapeados: no }));
  }
  if (sys.includes('Agente 3')) {
    const d = JSON.parse(user);
    const c = d.calculo;
    const corto = sys.includes('máximo 5 líneas') && !sys.includes('CORRECCIONES');
    const partidas = c.partidas.map((p) => '- ' + p.cantidad + ' × ' + p.articulo + ': ' + p.importe).join('\n');
    const txt = corto
      ? 'RESULTADO SIMULADO\nCotización para su ' + d.evento.tipo + ' del ' + d.evento.fecha + '.\n' + partidas + '\nTotal ' + c.total + ' con IVA.'
      : 'RESULTADO SIMULADO\nPropuesta para su ' + d.evento.tipo + ' del ' + d.evento.fecha + ' (' + d.evento.invitados + ' invitados, ' + d.evento.zona + ').\n' + partidas +
        '\nSubtotal: ' + c.subtotal + '\nDescuento: ' + c.descuento + '\nFlete: ' + c.flete + '\nIVA: ' + c.iva + '\nTotal: ' + c.total +
        '\nSupuestos: ' + (d.supuestos.join(' ') || 'ninguno adicional.') + ' Depósito en garantía ' + c.deposito_garantia + ' y anticipo para apartar ' + c.anticipo_para_apartar + '. Sujeto a aprobación.';
    return ok(txt);
  }
  if (sys.includes('Agente 4')) return ok(JSON.stringify({ veredicto: 'aprobado', correcciones: [] }));
  return { statusCode: 400, body: { error: { type: 'invalid_request_error' } } };
}

// ── Motor ──
function crearMotor(opciones = {}) {
  const staticData = {};
  const enviados = [];
  const llamadasModelo = [];
  let ejecucion = 0;
  const porNombre = Object.fromEntries(workflow.nodes.map((n) => [n.name, n]));

  async function ejecutar(trigger, json) {
    ejecucion += 1;
    const execId = String(ejecucion);
    const respuestas = [];
    const cola = [[trigger, [{ json }]]];
    let pasos = 0;
    while (cola.length) {
      if (++pasos > 400) throw new Error('bucle sin fin');
      const [nombre, items] = cola.shift();
      const n = porNombre[nombre];
      let salidas;                                   // arreglo de arreglos (una por salida)
      if (n.type.endsWith('Trigger') || n.type.endsWith('.webhook')) salidas = [items];
      else if (n.type.endsWith('.code')) {
        const f = new AsyncFn('$input', '$getWorkflowStaticData', '$execution', n.parameters.jsCode);
        const res = await f({ first: () => items[0], all: () => items }, () => staticData, { id: execId });
        salidas = [res || []];
      } else if (n.type.endsWith('.switch')) {
        const campo = /\$json\.(\w+)/.exec(n.parameters.output)[1];
        salidas = Array.from({ length: n.parameters.numberOutputs }, () => []);
        items.forEach((it) => { const i = Number(it.json[campo]); if (!(i >= 0 && i < salidas.length)) throw new Error(nombre + ': salida inválida ' + it.json[campo]); salidas[i].push(it); });
      } else if (n.type.endsWith('.httpRequest')) {
        salidas = [items.map((it) => {
          if (nombre === 'Cargar skills') return { json: opciones.sinSkills ? { statusCode: 404, body: 'Not Found' } : { statusCode: 200, body: bundle } };
          llamadasModelo.push(it.json.request.body);
          return { json: modeloFalso(it.json.request.body, opciones) };
        })];
      } else if (n.type.endsWith('.telegram')) {
        items.forEach((it) => enviados.push({ nodo: nombre, chat_id: it.json.chat_id, texto: it.json.texto, botones: it.json.botones || null }));
        salidas = [items];
      } else if (n.type.endsWith('.respondToWebhook')) {
        respuestas.push(items[0].json.respuesta);
        salidas = [items];
      } else throw new Error('tipo no simulado: ' + n.type);
      const con = (workflow.connections[nombre] || { main: [] }).main;
      salidas.forEach((its, i) => { if (its.length) (con[i] || []).forEach((dest) => cola.push([dest.node, its])); });
    }
    return { respuestas };
  }
  return { ejecutar, staticData, enviados, llamadasModelo };
}

module.exports = { crearMotor };
