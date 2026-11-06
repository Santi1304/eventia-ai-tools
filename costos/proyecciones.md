# Proyección mensual de costos

> Generado por `scripts/proyectar_costos.js` el 2026-11-05. Costo LLM por caso: **0.000851 USD (estimado)**.
> Supuestos (no medidos): mezcla de voz, minutos por conversación, LLM de voz por minuto, ejecuciones n8n por caso, factor de reintentos y tipo EUR/USD 1.08. Se supone que todos los planes de voz permiten minutos adicionales a 0.08 USD (verificar; si el plan Free no lo permite, el plan mínimo cambia). Tarifas de voz y n8n de fuentes secundarias: verificar en las páginas oficiales.

| Escenario | Casos/mes | Tarea programada | LLM USD | Min voz | Plan voz | Voz USD | LLM voz USD | Ejec. n8n | Plan n8n | n8n USD | **Total USD** | USD/caso |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base | 100 | cada_10_min | 0.0894 | 60 | Free | 3.60 | 0.60 | 4620 | Pro | 54.00 | **58.29** | 0.5829 |
| base | 100 | cada_hora | 0.0894 | 60 | Free | 3.60 | 0.60 | 1020 | Starter | 21.60 | **25.89** | 0.2589 |
| base | 1000 | cada_10_min | 0.8936 | 600 | Free | 46.80 | 6.00 | 7320 | Pro | 54.00 | **107.69** | 0.1077 |
| base | 1000 | cada_hora | 0.8936 | 600 | Free | 46.80 | 6.00 | 3720 | Pro | 54.00 | **107.69** | 0.1077 |
| base | 10000 | cada_10_min | 8.9355 | 6000 | Free | 478.80 | 60.00 | 34320 | Business/autohospedado (fuera de tabla) | n/d | **n/d** | n/d |
| base | 10000 | cada_hora | 8.9355 | 6000 | Free | 478.80 | 60.00 | 30720 | Business/autohospedado (fuera de tabla) | n/d | **n/d** | n/d |
| alto | 100 | cada_10_min | 0.1064 | 200 | Free | 14.80 | 8.92 | 4820 | Pro | 54.00 | **77.83** | 0.7783 |
| alto | 100 | cada_hora | 0.1064 | 200 | Free | 14.80 | 8.92 | 1220 | Starter | 21.60 | **45.43** | 0.4543 |
| alto | 1000 | cada_10_min | 1.0637 | 2000 | Free | 158.80 | 89.20 | 9320 | Pro | 54.00 | **303.06** | 0.3031 |
| alto | 1000 | cada_hora | 1.0637 | 2000 | Free | 158.80 | 89.20 | 5720 | Pro | 54.00 | **303.06** | 0.3031 |
| alto | 10000 | cada_10_min | 10.6375 | 20000 | Free | 1598.80 | 892.00 | 54320 | Business/autohospedado (fuera de tabla) | n/d | **n/d** | n/d |
| alto | 10000 | cada_hora | 10.6375 | 20000 | Free | 1598.80 | 892.00 | 50720 | Business/autohospedado (fuera de tabla) | n/d | **n/d** | n/d |

**Lectura:** el costo de modelo (LLM) es marginal frente a la plataforma de voz y a n8n; a 10,000 casos el plan de n8n deja de alcanzar y la voz domina el costo variable. La tarea programada cada 10 min consume 4320 ejecuciones/mes por sí sola (más que el plan Starter); cambiarla a cada hora libera 3600 ejecuciones sin tocar controles: el vencimiento también se verifica al intentar aprobar.
