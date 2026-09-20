/**
 * @class NearbyEarthquakes
 * @description Orquesta la consulta de sismos cercanos: llama EMSC y USGS en paralelo, deduplica, calcula distancia al Echo, filtra por radio y ordena por cercanía. Si una fuente falla, usa la otra; si fallan las dos, avisa que las fuentes no están disponibles.
 */
const { config } = require("../config");
const emscAdapter = require("../adapters/emscAdapter");
const usgsAdapter = require("../adapters/usgsAdapter");
const { dedupeEvents } = require("./dedupe");
const { haversineKm, hypocentralDistanceKm } = require("../geo/distance");
const { logger } = require("../logger");
const { allSettled } = require("../http");

/**
 * @function withDistance
 * @description Añade distancia epicentral e hipocentral al evento respecto a la ubicación del Echo. El orden de la respuesta hablada usa distanceKm.
 * @params {{latitude: number, longitude: number}} location - Coordenadas geocodificadas del dispositivo.
 * @params {object} event - EarthquakeEvent sin distancias.
 */
function withDistance(location, event) {
  const distanceKm = haversineKm(location, event);
  return Object.assign({}, event, {
    distanceKm,
    hypocentralDistanceKm: hypocentralDistanceKm(location, event),
  });
}

/**
 * @function compareNearby
 * @description Ordena primero por cercanía y, si empatan, por magnitud descendente, para narrar primero lo más relevante.
 * @params {object} a - Evento con distanceKm y magnitude.
 * @params {object} b - Evento con distanceKm y magnitude.
 */
function compareNearby(a, b) {
  if (a.distanceKm !== b.distanceKm) {
    return a.distanceKm - b.distanceKm;
  }
  return b.magnitude - a.magnitude;
}

/**
 * @function findNearbyEarthquakes
 * @description Consulta EMSC y USGS en paralelo, deduplica y filtra por radio. Si una fuente cae, la otra sigue; si caen las dos, lanza SOURCES_UNAVAILABLE.
 * @params {{latitude: number, longitude: number}} location - Ubicación del usuario ya geocodificada.
 * @params {object} options - Sobrescribe config para scripts de prueba.
 * @params {number} options.radiusKm - Radio en km; “cerca” es configurable, no un umbral científico.
 * @params {number} options.minMagnitude - Magnitud mínima para no leer microsismos irrelevantes por voz.
 * @params {number} options.lookbackHours - Ventana temporal de “recientes”.
 */
async function findNearbyEarthquakes(location, options = {}) {
  const query = {
    latitude: location.latitude,
    longitude: location.longitude,
    radiusKm: options.radiusKm == null ? config.searchRadiusKm : options.radiusKm,
    minMagnitude: options.minMagnitude == null ? config.minMagnitude : options.minMagnitude,
    lookbackHours: options.lookbackHours == null ? config.lookbackHours : options.lookbackHours,
  };

  const settled = await allSettled([
    emscAdapter.searchNearby(query),
    usgsAdapter.searchNearby(query),
  ]);

  const sources = ["EMSC", "USGS"];
  const collected = [];
  const sourceStatus = {};

  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      sourceStatus[source] = { ok: true, count: result.value.length };
      collected.push.apply(collected, result.value);
    } else {
      sourceStatus[source] = { ok: false, error: result.reason.message };
      logger.warn("source_failed", { source: source, error: result.reason.message });
    }
  });

  if (
    collected.length === 0 &&
    sourceStatus.EMSC &&
    sourceStatus.USGS &&
    !sourceStatus.EMSC.ok &&
    !sourceStatus.USGS.ok
  ) {
    const error = new Error("All earthquake sources failed");
    error.code = "SOURCES_UNAVAILABLE";
    error.sourceStatus = sourceStatus;
    logger.error("sources_unavailable", { sources: sourceStatus });
    throw error;
  }

  const nearby = dedupeEvents(collected)
    .map((event) => withDistance(location, event))
    .filter((event) => event.distanceKm <= query.radiusKm)
    .sort(compareNearby);

  logger.info("nearby_ready", {
    total: nearby.length,
    sources: sourceStatus,
  });

  return {
    events: nearby,
    sourceStatus,
    query,
  };
}

module.exports = { findNearbyEarthquakes };
