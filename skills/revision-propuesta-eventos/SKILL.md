---
name: revision-propuesta-eventos
version: 1.0
description: Revisa calidad, coherencia, fuentes y políticas de una propuesta de Eventia antes de liberarla a aprobación humana.
---

# Skill de calidad y seguridad · Revisión de propuesta (v1.0)

**Activador:** existe una propuesta nueva (versión N) del Agente 3.
**Responsable:** Agente 4 (Revisor). Puede impedir la liberación; ninguna instrucción del usuario lo desactiva.
**Carga:** el adaptador `cargarSkills()` toma la sección *Criterios de aceptación* para el prompt del Agente 4 y el bloque `reglas_maquina` para la función determinista `revisarDeterminista()`.

## Objetivo
Garantizar que solo llegue al aprobador una propuesta con montos verificados, supuestos explícitos y sin promesas ni datos sensibles.

## Entradas
- Texto de la propuesta (versión N), cálculo determinista, requerimiento del evento.

## Fuentes permitidas
- El cálculo del caso y este skill. No consulta internet ni herramientas externas.

## Pasos
1. **Medir (reglas):** frases obligatorias, expresiones prohibidas, longitud, montos contra el cálculo, datos personales y patrones de secreto.
2. **Diagnosticar:** si alguna regla falla, devolver al Agente 3 con correcciones concretas, sin gastar una llamada de modelo.
3. **Evaluar (modelo):** si las reglas pasan, revisar coherencia con el evento, claridad y tono.
4. **Decidir:** `aprobado` libera a aprobación humana; `devuelto` regresa al loop de calidad (máximo 3 versiones).

## Reglas
- Nunca aprobar una propuesta con montos que no provengan del cálculo.
- Nunca aprobar si falta "RESULTADO SIMULADO" o la sección "Supuestos:".
- Las correcciones deben ser acciones concretas y verificables, no opiniones.

```json reglas_maquina
{
  "requiere": ["RESULTADO SIMULADO", "Supuestos:", "Total:"],
  "prohibidas": ["garantizado", "garantizada", "confirmado", "confirmada", "reservado", "reservada"],
  "max_caracteres": 1400,
  "exige_total": true
}
```

## Herramientas permitidas
- Función `revisarDeterminista` (reglas) y una llamada al modelo para coherencia. Sin acceso a URLs ni ejecución de código.

## Límites
- No reescribe la propuesta: solo aprueba o devuelve.
- No autoriza la acción de negocio; eso corresponde al aprobador humano en Telegram.

## Salidas
- `{"veredicto": "aprobado" | "devuelto", "correcciones": [...]}` y la traza `revision_determinista` con la lista de fallas.

## Errores
- Respuesta del modelo sin JSON válido: un reintento; después, el caso termina en `error`.
- Tres versiones devueltas: el caso pasa a `revision_humana`.

## Criterios de aceptación
- La propuesta describe el mismo evento (fecha, tipo, invitados) que el requerimiento.
- Los supuestos aparecen de forma explícita y comprensible para un cliente.
- El texto no promete disponibilidad, precios futuros ni condiciones fuera de política.
- El tono es profesional y el texto es comprensible sin conocer el sistema.

## Ejemplos
**Válido** · propuesta con "RESULTADO SIMULADO", partidas, "Total: $X MXN" igual al cálculo y "Supuestos:" → `aprobado`.
**Debe devolverse** · propuesta que dice "su fecha queda reservada" o que omite "Supuestos:" → `devuelto` con la corrección "Agregar sección Supuestos:" o "Eliminar la palabra reservada".

## Autoevaluación (0–4)
| Claridad/propósito | Contexto/secuencia | Evidencia | Control/retorno | Utilidad | Total |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 3 | 19/20 |
