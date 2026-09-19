# Sismos Cercanos (Alexa)

Skill de Alexa que **consulta sismos ya publicados** cerca de la dirección configurada en el Echo.

No es un sistema de alerta temprana. No predice terremotos. No inicia audio por su cuenta: responde cuando la persona dice, por ejemplo, *“Alexa, abre sismos cercanos”*.

## Qué hace el MVP

1. Pide permiso para leer la **dirección del dispositivo** (el Echo no tiene GPS).
2. Convierte esa dirección en coordenadas (Nominatim / OpenStreetMap).
3. Consulta en paralelo:
   - [EMSC FDSN-event](https://www.seismicportal.eu/fdsn-wsevent.html)
   - [USGS Earthquake Catalog](https://earthquake.usgs.gov/fdsnws/event/1/)
4. Deduplica el mismo evento si aparece en ambas fuentes.
5. Dice los sismos más cercanos en las últimas 48 horas, con magnitud, distancia, lugar, hora y profundidad.
6. Recuerda en cada respuesta que la información no predice y no reemplaza canales oficiales.

El Servicio Geológico Colombiano **no** está integrado todavía: el feed existe, pero sus términos piden autorización escrita para un servicio derivado.

## Frases

Locale: `es-US` (el que Amazon recomienda en Colombia).

- “Alexa, abre sismos cercanos”
- “Alexa, pregúntale a sismos cercanos si hay temblores cerca”
- “Alexa, pide a sismos cercanos los últimos sismos”

## Requisitos

- Node.js 20+
- Cuenta de [Amazon Developer](https://developer.amazon.com/)
- Un Echo o la app Alexa, con **dirección completa** en la configuración del dispositivo
- AWS Lambda (o un HTTPS endpoint) para hospedar el código

No hay dependencias de npm: el runtime de Node 20 incluye `fetch`.

## Uso local

```bash
cp .env.example .env
npm test
node scripts/query-nearby.js --lat=4.711 --lon=-74.072
```

`scripts/simulate-alexa.js` usa `DEFAULT_LAT` / `DEFAULT_LON` del `.env` y `ALLOW_DEFAULT_LOCATION=true`. No llama a la API de dirección de Alexa.

En algunos Windows el antivirus intercepta HTTPS y `fetch` falla. Para probar en local (nunca en Lambda):

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/query-nearby.js --lat=4.711 --lon=-74.072
```

## Publicar la skill

Pasos en [docs/alexa-setup.md](docs/alexa-setup.md).

## Privacidad

La dirección se usa **solo durante la petición**. No se guarda en base de datos. Los logs no incluyen calle ni número: como máximo ciudad y país.

Ver [docs/privacidad.md](docs/privacidad.md).

## Arquitectura del MVP

```text
Usuario habla
    → Alexa Skill (es-US)
    → Device Address API
    → Geocoder (Nominatim)
    → EMSC + USGS (en paralelo)
    → Dedupe + distancia
    → Respuesta hablada
```

Cada fuente tiene un adapter (`src/adapters`). El modelo común está en `src/quakes/normalize.js`.

## Limitaciones

- No hay sirena automática.
- La “ubicación de Alexa” es la dirección escrita en la app, no un GPS.
- Los catálogos públicos llegan minutos después del origen, no en segundos.
- Nominatim tiene política de uso: 1 petición por segundo y User-Agent identificable.
- Para certificación en Amazon hay que poner URLs reales de privacidad y términos en `skill-package/skill.json`.

## Roadmap posterior

Alertas proactivas, SGC con autorización, app móvil y evaluación de riesgo más fina quedan fuera de este MVP. La investigación de esa línea está en el canvas de Fase 1.
