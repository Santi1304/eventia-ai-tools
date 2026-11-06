# Loops ejecutables

Ambos loops se ejecutan en el workflow de n8n (`Orquestador → Siguiente → Claude API → Registrar llamada → Orquestador`). El código está en `agentes/nucleo.js`.

## Loop 1 · Calidad de negocio
**Secuencia:** Generar (A3) → Medir (`revisarDeterminista`: frases obligatorias, montos vs. cálculo, prohibidas, longitud, PII) → Diagnosticar (lista de fallas) → Corregir (A3 recibe las fallas como correcciones obligatorias) → Validar (A4 con modelo). Liberar solo si pasa reglas **y** veredicto `aprobado`.

| Parámetro | Valor | Justificación |
|---|---|---|
| Entrada | Cálculo determinista + requerimiento + skills | — |
| Responsable | Orquestador (control), A3 (genera), A4 (valida) | Separación generar/validar |
| Criterios | `reglas_maquina` del skill de revisión + criterios de aceptación | Ver `skills/revision-propuesta-eventos/SKILL.md` |
| Máx. iteraciones | 3 versiones (`max_iteraciones_calidad`) | Valor de partida de la guía; una 4.ª versión rara vez corrige lo que no corrigieron 3 |
| Tiempo límite | 180 s por caso (`timeout_caso_ms`) | Experiencia de chat |
| Presupuesto | El del caso (0.02 USD) | Compartido con el loop 2 |
| Acción de retorno | Volver a A3 con correcciones; si fallan reglas no se gasta llamada de A4 | Ahorro sin bajar control |
| Estado al agotar | `revision_humana` | Nunca se libera una propuesta no aprobada |

## Loop 2 · Seguridad y costo
**Secuencia:** Evaluar permisos y presupuesto (`pedirLlamada`) → Ejecutar el paso autorizado (HTTP a Claude) → Registrar consumo medido (`registrarLlamada`, tokens reportados por la API) → Revisar límite y resultado (`aplicarRespuesta`) → Continuar o detener.

| Parámetro | Valor | Justificación |
|---|---|---|
| Entrada | Solicitud del agente + estado del caso | — |
| Responsable | Orquestador | Controles del servidor, no del prompt |
| Criterios | Costo proyectado ≤ 80 % del restante; llamadas ≤ 10; prompt ≤ 20K tokens; salida sin patrones de secreto | Margen de 20 % para la variación entre estimado y medido |
| Máx. iteraciones | 10 llamadas por caso; 1 reintento por paso | Un caso completo usa 4–6 llamadas |
| Tiempo límite | 30 s por llamada HTTP; 180 s por caso | — |
| Presupuesto | 0.02 USD por caso (reducible con `/nuevo limite=...`, nunca ampliable por el usuario) | ~8× el costo estimado de un caso normal |
| Acción de retorno | Reintento acotado ante 429/529/red; formato inválido → 1 reintento | — |
| Estado al agotar | `detenido_presupuesto`, `detenido_limite` o `error` con causa en la traza | — |

## Autoevaluación (0–4)
| Loop | Claridad | Secuencia | Evidencia | Control/retorno | Utilidad | Total |
|---|---|---|---|---|---|---|
| Calidad de negocio | 4 | 4 | 3 | 4 | 4 | 19/20 |
| Seguridad y costo | 4 | 3 | 4 | 4 | 3 | 18/20 |

Evidencia de V1 → V2: `loops/evidencia_v1_v2.md` (se llena con la ejecución real).
