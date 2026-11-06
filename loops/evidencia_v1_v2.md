# Evidencia V1 → V2 y reutilización (P11)

> **Pendiente de ejecución real.** Llenar con la traza exportada de n8n. No escribir valores que no salgan de la traza.

## Cómo reproducir
1. En Telegram (usuario autorizado): `/nuevo skill=1.0 boda el AAAA-MM-DD, 90 invitados, zona centro, 90 sillas tiffany y 9 mesas redondas`
2. Exportar la traza: `node scripts/exportar.js` (o `GET /webhook/eventia-export?folio=EVT-...`).
3. Segundo caso con el skill vigente v1.1: `/nuevo xv años el AAAA-MM-DD, 80 invitados, zona sur, sillas plegables`.

## Resultado (llenar desde `evidencias/trazas/<folio>.json`)
| Campo | V1 | V2 |
|---|---|---|
| caso_id | | (mismo) |
| skill cargado | cotizacion-mobiliario-eventos@1.0 #hash | (mismo) |
| Fallas de `revision_determinista` | | ninguna |
| Veredicto A4 | (no se llamó: devuelto por reglas) | aprobado |
| llamada_id A3 | | |
| Costo adicional por la corrección (USD) | — | |

**Diagnóstico:** la regla de v1.0 "sin secciones adicionales" contradice el criterio "Supuestos:" del skill de revisión.
**Corrección del skill:** v1.1 agrega la sección "Supuestos:" y la línea "Total:" (ver historial en `SKILL.md`).
**Reutilización:** segundo caso `EVT-...` con v1.1 aprobado en la versión 1 (llenar).
