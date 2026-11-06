# Arquitectura

```mermaid
flowchart LR
  subgraph Publico["Zona pública"]
    TG[Usuario en Telegram]
    WEB[GitHub Pages · index.html<br/>panel VizData + widget]
    VOZ[Agente ElevenLabs]
  end
  subgraph Privado["Zona privada · n8n Cloud"]
    TT[Telegram Trigger<br/>entrada única] --> ET[Entrada Telegram<br/>acceso · dedup · inyección]
    WV[Webhook voz<br/>encabezado secreto] --> EV[Entrada voz<br/>validación · idempotencia]
    ET --> R{Ruta}
    EV --> R
    R -->|procesar| SK[Cargar skills<br/>bundle.json + hash]
    SK --> O[Orquestador<br/>presupuesto · fases · cierre]
    O -->|llamar| API[Claude API<br/>claude-haiku-5-5]
    API --> RL[Registrar llamada<br/>tokens medidos · costo]
    RL --> O
    O -->|fin| CC[Cerrar caso]
    CC --> MSG[Telegram: propuesta + botones Aprobar/Rechazar]
    ST[(Static data<br/>casos · reservas · llamadas · eventos)]
    PR[Programado c/10 min<br/>vencimientos] --> MSG
    WE[Webhook export<br/>encabezado secreto] --> EXP[Exportar sanitizado]
  end
  subgraph CI["GitHub Actions"]
    VAL[Pruebas + validar.js] -->|pasa| DEP[Deploy Pages] --> VER[Verificar sitio]
  end
  TG --> TT
  MSG --> TG
  WEB --> VOZ -->|consultar_folio / crear_solicitud| WV
  EXP -->|scripts/exportar.js + commit| VAL
  DEP --> WEB
  SK -. lee .-> WEB
```

**Mismo `caso_id` en todo el recorrido:** folio creado en «Entrada Telegram» o «Entrada voz» → traza del orquestador y los cuatro agentes → `llamada_id` en costos → callback `ap|FOLIO|versión` → fila del panel publicado.

**Dónde corre cada componente**
| Componente | Dónde | Estado |
|---|---|---|
| Bot, orquestador, agentes, registro | n8n Cloud (workflow activo, URL de producción) | Privado |
| Modelo | API de Anthropic (`claude-haiku-5-5`) | Credencial en n8n |
| Voz | ElevenLabs (agente público con dominios permitidos) | Secreto del webhook en ElevenLabs |
| Panel, skills publicados | GitHub Pages | Público, solo datos ficticios agregados |
| Validación y publicación | GitHub Actions | Sin secretos |
