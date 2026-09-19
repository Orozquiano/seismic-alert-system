# Notas técnicas del MVP

## Fuentes usadas

| Fuente | Endpoint | Uso |
|---|---|---|
| EMSC | `https://www.seismicportal.eu/fdsnws/event/1/query` | Consulta FDSN JSON por radio (maxradius en grados) |
| USGS | `https://earthquake.usgs.gov/fdsnws/event/1/query` | Consulta FDSN GeoJSON por `maxradiuskm` |
| Nominatim | `https://nominatim.openstreetmap.org/search` | Geocodifica la dirección del Echo |
| Alexa | Device Settings Address + timezone | Ubicación y zona horaria, con permiso |

SGC, Google Earthquake Alerts y WebSocket EMSC no forman parte de este MVP.

## Modelo EarthquakeEvent

Campos normalizados: `id`, `source`, `sourceEventId`, `magnitude`, `magnitudeType`, `latitude`, `longitude`, `depthKm`, `originTime`, `updateTime`, `locationDescription`, `eventType`, `status`, `rawData`. En el resultado cercano se añaden `distanceKm` y `hypocentralDistanceKm`.

## Deduplicación

Dos eventos se consideran el mismo si:

- la diferencia de origen es ≤ 90 s
- la distancia entre epicentros es ≤ 80 km
- la diferencia de magnitud es ≤ 1.0

Si coinciden, se prefiere el registro `reviewed` / `manual` y, en empate, USGS (suele traer `place` más legible). Estos umbrales son de ingeniería y están en `src/quakes/dedupe.js`.

## Latencia

Alexa exige respuesta en ~8 s. Cada HTTP usa timeout de 3.5 s. EMSC y USGS se piden en paralelo.

## Lo que no hace

- No reproduce alertas no solicitadas.
- No usa GPS del Echo (no existe).
- No almacena la dirección.
- No afirma que “va a ocurrir un terremoto”.
