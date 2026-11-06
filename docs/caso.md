# Definición del caso (1 página)

**Empresa:** Eventia Renta de Mobiliario, S.A. de C.V. — **ficticia**. Sector: renta de mobiliario para eventos sociales y corporativos.

**Usuario:** el cliente que pide una cotización (por Telegram o voz) y el **coordinador de reservas** de Eventia, que aprueba o rechaza apartar inventario.

**Problema:** las cotizaciones se arman a mano cruzando catálogo, disponibilidad por fecha, flete, descuentos e IVA. Tardan, tienen errores de cálculo y a veces se promete una fecha sin inventario.

**Decisión que se apoya:** ¿apartamos (simuladamente) el inventario para este evento con esta cotización? La toma una persona con la propuesta revisada a la vista.

**Proceso delimitado:** *inicio* = solicitud de cotización recibida · *fin* = propuesta revisada y decisión humana registrada (aprobada, rechazada o vencida). No cubre cobro, logística de entrega ni facturación.

| Elemento | Definición |
|---|---|
| Entradas | Fecha del evento, invitados, zona, tipo de evento, días de renta, artículos (texto libre o datos de voz) |
| Fuentes permitidas | `datos/catalogo.json` (precios, stock, zonas, políticas) y reservas privadas por fecha |
| Reglas de negocio | Anticipación 3–180 días; 10–500 invitados; 1–3 días; zonas centro/norte/sur/oriente; pedido mínimo $1,500; descuento 5 %/8 %; IVA 16 %; depósito 20 %; anticipo 50 % |
| Salida útil | Propuesta con partidas, total con IVA y supuestos, folio y versión |
| Acción con aprobación humana | Apartar inventario para la fecha (operación de prueba sobre la tabla de reservas) |

## KPI
| KPI | Fórmula | Unidad | Periodo | Fuente | Meta (no es resultado) |
|---|---|---|---|---|---|
| Tiempo mediano de cotización | mediana(`solicita_aprobacion_humana` − `caso_creado`) en casos liberados por el Agente 4 | segundos | ventana de pruebas | traza del caso | ≤ 300 s |
| Tasa de apartado simulado | aprobados ÷ (aprobados + rechazados + vencidos) × 100 | % | ventana de pruebas | estados finales | referencia, sin meta |
| Costo de modelo por cotización | Σ costo LLM medido de casos liberados ÷ nº de casos liberados | USD/caso | ventana de pruebas | `costos_operacion.csv` (tokens de la API) | ≤ 0.02 USD (límite del caso) |

Los casos no completados se reportan aparte (costo y conteo) para no ocultarlos.

## Qué es real, qué es ficticio y qué es simulado
| Real (en vivo) | Ficticio | Simulado |
|---|---|---|
| Bot de Telegram, n8n Cloud, API de Anthropic, ElevenLabs, GitHub Pages y Actions | Empresa, catálogo, precios, reservas iniciales, clientes | El apartado de inventario, la cotización como compromiso comercial; no hay cobros, envíos ni clientes reales |

Las APIs sí generan consumo real (tokens y minutos), que se registra en el costo.
