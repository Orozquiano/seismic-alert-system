#!/usr/bin/env node
/**
 * @class QueryNearbyScript
 * @description Script CLI para probar la consulta de sismos sin Alexa. Recibe --lat y --lon (o DEFAULT_LAT/DEFAULT_LON) e imprime JSON y el speech que diría la skill.
 */
const { findNearbyEarthquakes } = require("../src/quakes/nearby");
const { nearbySpeech } = require("../src/speech/es");
const { config } = require("../src/config");

/**
 * @function arg
 * @description Lee un argumento CLI --nombre=valor. Permite probar coordenadas sin Alexa.
 * @params {string} name - Nombre del flag (lat o lon).
 * @params {*} fallback - Valor de .env (DEFAULT_LAT / DEFAULT_LON) si no se pasó el flag.
 */
function arg(name, fallback) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

/**
 * @function main
 * @description Consulta sismos cerca de unas coordenadas e imprime JSON + speech. Es el banco de pruebas local del MVP.
 */
async function main() {
  const latitude = Number(arg("lat", config.defaultLat));
  const longitude = Number(arg("lon", config.defaultLon));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.error("Pass --lat= and --lon= or set DEFAULT_LAT / DEFAULT_LON.");
    process.exit(1);
  }

  const result = await findNearbyEarthquakes({ latitude, longitude });
  const speech = nearbySpeech({
    events: result.events,
    query: result.query,
    timeZone: config.defaultTimezone,
  });

  console.log(
    JSON.stringify(
      {
        query: result.query,
        sources: result.sourceStatus,
        events: result.events.map((event) => ({
          source: event.source,
          magnitude: event.magnitude,
          distanceKm: Math.round(event.distanceKm),
          place: event.locationDescription,
          originTime: event.originTime.toISOString(),
        })),
        speech,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
