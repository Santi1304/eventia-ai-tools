---
name: cotizacion-mobiliario-eventos
version: 1.1
description: Redacta la propuesta comercial de renta de mobiliario de Eventia a partir de un cálculo determinista ya verificado.
---

# Skill de negocio · Cotización de mobiliario para eventos (v1.1)

**Activador:** el orquestador entra a la fase A3 de un caso con requerimiento validado (Agente 1) y disponibilidad verificada (Agente 2).
**Responsable:** Agente 3 (Propuesta). **Carga:** el adaptador `cargarSkills()` de `agentes/nucleo.js` lee este archivo desde `skills/bundle.json` publicado en GitHub Pages, verifica su hash y metadatos y copia la sección *Reglas* al prompt del Agente 3. La traza del caso registra `skill_version` en cada llamada del Agente 3.

## Objetivo
Convertir el cálculo de la cotización en un texto claro que el cliente pueda leer y que el aprobador humano pueda autorizar, sin alterar ninguna cifra.

## Entradas
- `requerimiento`: fecha_evento, tipo_evento, invitados, dias_renta, zona (salida del Agente 1).
- `calculo`: partidas, subtotal, descuento, flete, IVA, total, depósito y anticipo (función `calcularCotizacion`, determinista).
- `supuestos`: advertencias acumuladas por los Agentes 1 y 2.
- `correcciones`: lista del Agente 4 cuando la versión anterior fue devuelta.

## Fuentes permitidas
- `datos/catalogo.json` (versión indicada en la traza) y el cálculo recibido. Ninguna otra.

## Pasos
1. Leer el evento y el cálculo.
2. Redactar saludo breve y descripción del evento.
3. Listar partidas con cantidad e importe tal como vienen.
4. Mostrar subtotal, descuento, flete, IVA y total.
5. Escribir la sección de supuestos y condiciones.
6. Si hay correcciones del revisor, aplicarlas todas antes de entregar.

## Reglas
- Usa únicamente los montos del cálculo recibido, con el formato exacto que traen (por ejemplo $1,234.00 MXN); no calcules, redondees ni inventes montos.
- Escribe la línea "RESULTADO SIMULADO" al inicio de la propuesta.
- Incluye una sección titulada "Supuestos:" con los supuestos recibidos y con las condiciones: depósito en garantía, anticipo para apartar y vigencia sujeta a aprobación.
- Muestra el total con IVA en una línea propia que empiece con "Total:".
- No uses palabras de compromiso definitivo como garantizado, confirmado o reservado; el apartado depende de una aprobación humana.
- No incluyas teléfonos, correos ni nombres de personas.
- Máximo 1,200 caracteres.

## Herramientas permitidas
- Ninguna. El Agente 3 solo produce texto; el cálculo ya lo hizo una función determinista.

## Límites
- No negocia precios, no ofrece descuentos fuera de política y no promete disponibilidad.
- No responde preguntas ajenas a la cotización.

## Salidas
- Texto plano de la propuesta (versión N). El orquestador la guarda como `propuestas[N]` con la versión del skill.

## Errores
- Si el cálculo no llega o viene vacío: el orquestador no invoca este skill.
- Si la salida excede el límite de tokens (`stop_reason: max_tokens`): se registra y se reintenta una vez.

## Criterios de aceptación
- Contiene "RESULTADO SIMULADO", "Supuestos:" y "Total:".
- Todos los montos coinciden con el cálculo (lo verifica la función `revisarDeterminista`).
- Ninguna expresión de compromiso definitivo.

## Ejemplos
**Válido** · entrada: boda, 2026-12-05, 120 invitados, zona norte, 120 sillas tiffany, 12 mesas redondas → salida con las cinco partes, total igual al cálculo y sección "Supuestos:".
**Debe rechazarse / pedir aclaración** · el cálculo llega sin `total` o con partidas vacías → el orquestador no invoca el skill y el caso se cierra como `error` o `aclaracion`.

## Historial de versiones
- **v1.0** (historial/v1.0.md): pedía una respuesta de máximo 5 líneas y sin secciones. Falló el criterio "Supuestos:" en la prueba P11 (ver `loops/evidencia_v1_v2.md`).
- **v1.1**: agrega la sección "Supuestos:", la línea "Total:" y el límite de 1,200 caracteres.

## Autoevaluación (0–4)
| Claridad/propósito | Contexto/secuencia | Evidencia | Control/retorno | Utilidad | Total |
|---|---|---|---|---|---|
| 4 | 3 | 4 | 3 | 4 | 18/20 |
