# Eventia · Cotizador agéntico de mobiliario (AI Tools · proyecto final)

Empresa **ficticia**. Modo **SIMULADO**: las APIs funcionan y consumen, pero ninguna operación genera cobros, envíos ni compromisos reales.

Una persona pide una cotización por **Telegram** o por el **asistente de voz** del sitio. Un **orquestador** coordina a **cuatro agentes** (intake, catálogo, propuesta y revisor), aplica **guardrails**, **skills** y **loops**, registra el **costo por llamada** y solicita **aprobación humana** en Telegram. El panel en **GitHub Pages** muestra los KPI con datos sanitizados que publica **GitHub Actions** solo si pasan los controles.

| | Enlace |
|---|---|
| Panel público | https://santi1304.github.io/eventia-ai-tools/ |
| Ejecuciones de Actions | https://github.com/Santi1304/eventia-ai-tools/actions |
| Bot de Telegram | Se comparte por el canal privado del curso (el token nunca está en el repo) |

## Estructura
```
agentes/    núcleo (orquestador + 4 agentes + guardrails + costos), instrucciones y contratos
n8n/        workflow exportable (sin secretos), cuerpo de cada nodo Code, config de ejemplo
skills/     cotizacion-mobiliario-eventos (negocio) y revision-propuesta-eventos (calidad/seguridad)
loops/      definición de los dos loops y evidencia V1 → V2
web/        index.html (panel + voz), datos/publico.json (exportación sanitizada), skills/bundle.json
datos/      catálogo y reservas iniciales ficticias
costos/     tarifas con fuente y fecha, registro por llamada, proyecciones
tests/      pruebas automáticas (simulador) y matriz pruebas.csv
evidencias/ trazas sanitizadas e índice de evidencias
docs/       caso, arquitectura, ElevenLabs, informe
scripts/    generar workflow y skills, validar, exportar, proyectar costos
.github/workflows/publicar.yml   validación → despliegue → verificación
```

## Requisitos y versiones
- Node.js ≥ 20 (probado con 22) solo para scripts y pruebas; sin dependencias npm.
- n8n Cloud (o autohospedado con HTTPS) — anota la versión en `docs/entorno.md`.
- Cuenta de Anthropic con API key; modelo `claude-haiku-5-5`.
- Bot de Telegram (BotFather), cuenta de ElevenLabs, repositorio público en GitHub.

## Puesta en marcha (orden recomendado)

### 1. Publicar el sitio
1. Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
2. Haz push a `main`. El workflow *Validar y publicar panel* corre pruebas y controles; si pasan, despliega y verifica la URL.

### 2. Preparar la configuración local (no se sube)
```bash
cp n8n/config.ejemplo.json n8n/config.local.json
```
Llena en `config.local.json`:
- `skills_url`: `https://santi1304.github.io/eventia-ai-tools/skills/bundle.json`
- `usuarios_autorizados` y `aprobadores`: tu ID numérico de Telegram (obténlo escribiendo a @userinfobot).
- `chat_aprobador`: el mismo ID (chat privado con el bot).

Genera el workflow e impórtalo:
```bash
npm run build:local        # → n8n/eventia_workflow.local.json
```

### 3. n8n
1. *Workflows → Import from file* → `n8n/eventia_workflow.local.json`.
2. Crea y vincula las credenciales (los nodos marcados en rojo):
   - **Eventia Bot (Telegram)** — tipo *Telegram API*, token de BotFather. Nodos: Telegram Trigger, Enviar Telegram, Enviar aprobación.
   - **Anthropic API Key (x-api-key)** — tipo *Header Auth*, Name `x-api-key`, Value tu API key. Nodo: Claude API.
   - **Eventia Voz (encabezado)** — *Header Auth*, Name `x-eventia-key`, Value un secreto largo aleatorio. Nodo: Webhook voz.
   - **Eventia Export (encabezado)** — *Header Auth*, Name `x-eventia-key`, Value **otro** secreto. Nodo: Webhook export.
3. **Activa** el workflow (interruptor *Active*). Solo con el workflow activo funcionan las URL de producción y se guarda el registro persistente (static data no se guarda en ejecuciones manuales de prueba).
4. No conectes otro receptor al mismo bot (ni polling ni otro webhook).

### 4. Probar un caso
En Telegram, con tu bot:
```
/nuevo boda el 2026-12-05, 120 invitados, zona norte, 120 sillas tiffany y 12 mesas redondas
```
Resultado esperado: folio `EVT-…`, propuesta con "RESULTADO SIMULADO" y total **$7,052.80 MXN** (120×35 + 12×90 = 5,280 + flete 800 = 6,080 + IVA 972.80), y un mensaje de aprobación con botones. `/estado FOLIO` y `/costo FOLIO` consultan el registro.

### 5. Voz
Sigue `docs/elevenlabs.md`. Después reemplaza `REEMPLAZAR_AGENT_ID` en `web/index.html` por el ID público del agente y haz push.

### 6. Exportar datos al panel
```bash
export N8N_EXPORT_URL="https://TU-INSTANCIA.app.n8n.cloud/webhook/eventia-export"
export EVENTIA_EXPORT_KEY="(el secreto de Eventia Export)"
npm run exportar && npm run proyectar
git add web/datos costos evidencias && git commit -m "Exportación sanitizada" && git push
```
Mecanismo: exportación **manual reproducible** + commit → Actions valida y publica. Frecuencia: al terminar cada bloque de pruebas. Retraso esperado: el del último commit (el panel muestra la fecha y avisa si pasan 48 h).

## Validación
```bash
npm test          # flujo completo sobre un simulador de n8n (modelo y Telegram son dobles de prueba)
npm run validar   # los mismos controles que bloquean el despliegue en Actions
```
El simulador prueba la lógica; **no** sustituye la evidencia real, que sale de n8n, Telegram, ElevenLabs y la API.

## Parada
Desactiva el workflow en n8n (deja de responder Telegram y voz). El sitio sigue publicado con la última exportación.

## Solución de problemas
| Síntoma | Revisión |
|---|---|
| Telegram no responde | Workflow activo; un solo receptor por bot; credencial correcta |
| El caso termina en `error: skills_no_disponibles` | Abre `skills_url` en el navegador; Pages debe estar publicado |
| `fallo_api:http_401` | API key o nombre de encabezado `x-api-key` |
| `fallo_api:http_400` | Revisa la ejecución en n8n: cuerpo de la solicitud al modelo |
| La voz inventa un estado | El prompt obliga a usar la herramienta; revisa el historial de la conversación en ElevenLabs |
| Actions falla | Lee el paso *Validación…*: indica el control y el archivo |

## Uso de IA
Ver `docs/declaracion_uso_ia.md`.
