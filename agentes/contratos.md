# Contratos de entrada y salida

Formato común JSON. Todos los registros comparten `caso_id` (folio `EVT-AAMMDD-NNNN`) entre Telegram, voz, traza, aprobación y costos. No se guardan secretos ni razonamiento interno: solo decisiones y resultados observables.

## Entrada mínima de un caso (creada por `crearCaso`)
```json
{
  "caso_id": "EVT-261105-0001",
  "canal": "telegram | voz",
  "usuario": "tg_1a2b3c4d  (seudónimo, hash del ID; el ID real nunca sale del almacén privado)",
  "objetivo": "cotizar_mobiliario_evento",
  "entrada": { "texto": "texto con PII enmascarada", "datos": "objeto estructurado (voz) o null", "estructurada": true },
  "modo": "SIMULADO",
  "limite_costo_usd": 0.02
}
```

## Salida mínima de cada paso (evento de traza)
```json
{
  "n": 12,
  "fecha_hora": "2026-11-05T17:02:11.204Z",
  "caso_id": "EVT-261105-0001",
  "agente": "orquestador | agente_1_intake | agente_2_catalogo | agente_3_propuesta | agente_4_revisor | aprobador_humano | guardrail_entrada | canal_voz",
  "evento": "invoca | respuesta_modelo | requerimiento | disponibilidad | calculo | propuesta | revision_determinista | veredicto | cierre | ...",
  "datos": { "estado": "...", "resultado": "...", "fuentes": ["catalogo v2026-11-04"], "advertencias": [], "llamada_id": "EVT-261105-0001-L03" }
}
```
La duración y el consumo de cada llamada están en la fila `llamada_id` del registro de costos (`costos/costos_operacion.csv`).

## Contrato por rol

| Rol | Recibe | Entrega | Validación del servidor |
|---|---|---|---|
| **Orquestador** (`orquestar`) | Caso, skills cargados | `{accion: "llamar", agente, solicitud}` o `{accion: "fin"}`; estados y cierre | Presupuesto proyectado antes de llamar, máx. llamadas, máx. 3 versiones, timeout por caso, falla cerrada si no cargan los skills |
| **Agente 1 · Intake** | Texto del usuario como `<datos_usuario>` | `{fecha_evento, invitados, tipo_evento, zona, dias_renta, articulos[], notas}` | `validarRequerimiento`: formato, faltantes → `aclaracion`; anticipación, rango de invitados, zona → `fuera_politica`. Por voz no usa LLM (datos ya estructurados) |
| **Agente 2 · Catálogo** | `articulos[]` + catálogo autorizado | `{lineas:[{sku, cantidad}], no_mapeados:[]}` | SKUs inexistentes se descartan; cantidades faltantes por regla; `verificarDisponibilidad` contra stock − reservas de la fecha → `sin_disponibilidad` o declaración de insuficiencia |
| **Agente 3 · Propuesta** | Cálculo de `calcularCotizacion` (determinista) + reglas del skill de negocio + correcciones | Texto de la propuesta versión N | No calcula: solo redacta. Se guarda con versión y skill |
| **Agente 4 · Revisor** | Propuesta N + cálculo + requerimiento + skill de revisión | `{veredicto: "aprobado" \| "devuelto", correcciones: []}` | `revisarDeterminista` corre antes y puede devolver sin gastar LLM; solo `aprobado` libera a aprobación humana |
| **Aprobador humano** | Botón o comando con folio y versión | `aprobado_simulado`, `rechazado` o `vencido` | Solo IDs en `aprobadores`, versión vigente, dentro de 30 min, revalida stock; idempotente |

## Por qué cada especialista es necesario
- **A1** convierte lenguaje libre en un requerimiento verificable; sin él, A2 y A3 trabajarían sobre suposiciones.
- **A2** es el único que toca catálogo y reservas; separa "qué pidió" de "qué existe y está libre".
- **A3** traduce números a una propuesta legible; no puede cambiar cifras porque las recibe calculadas.
- **A4** tiene poder de veto; sin él, una propuesta con montos inventados o promesas llegaría al cliente.
