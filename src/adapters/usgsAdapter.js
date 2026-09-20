/**
 * @class UsgsAdapter
 * @description Adapter del USGS. Intenta FDSN y, si falla desde Lambda, el feed GeoJSON semanal (archivo estático, más fiable en AWS).
 */
const { config } = require("../config");
const { fetchJson, withQuery } = require("../http");
const { isoHoursAgo, normalizeEvent, isValidEvent } = require("../quakes/normalize");
const { logger } = require("../logger");

/**
 * @function mapUsgsFeature
 * @description Mapea un Feature GeoJSON de USGS al modelo común. Coordenadas USGS: [lon, lat, depth]; time/updated vienen en epoch milisegundos.
 * @params {object} feature - Feature del Catalog API (id, properties.mag, place, time, status, geometry).
 */
function mapUsgsFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry && feature.geometry.coordinates;

  return normalizeEvent({
    source: "USGS",
    sourceEventId: feature.id || String(props.net || "") + String(props.code || ""),
    magnitude: props.mag,
    magnitudeType: props.magType,
    latitude: Array.isArray(coords) ? coords[1] : null,
    longitude: Array.isArray(coords) ? coords[0] : null,
    depthKm: Array.isArray(coords) ? coords[2] : null,
    originTime: props.time,
    updateTime: props.updated,
    locationDescription: props.place,
    eventType: props.type,
    status: props.status,
    rawData: feature,
  });
}

/**
 * @function mapFeatures
 * @description Convierte features GeoJSON válidos al modelo común.
 * @params {object} body - FeatureCollection USGS.
 */
function mapFeatures(body) {
  const features = (body && body.features) || [];
  return features.map(mapUsgsFeature).filter(isValidEvent);
}

/**
 * @function searchFdsn
 * @description Consulta FDSN con círculo en kilómetros.
 * @params {object} query - lat, lon, radio, magnitud y ventana.
 */
async function searchFdsn(query) {
  const url = withQuery(config.usgsFdsnUrl, {
    format: "geojson",
    latitude: query.latitude,
    longitude: query.longitude,
    maxradiuskm: query.radiusKm,
    minmagnitude: query.minMagnitude,
    starttime: isoHoursAgo(query.lookbackHours),
    limit: "20",
    orderby: "time",
  });
  const { body, elapsedMs } = await fetchJson(url);
  const events = mapFeatures(body);
  logger.info("usgs_fdsn_ok", { elapsedMs: elapsedMs, count: events.length });
  return events;
}

/**
 * @function searchFeed
 * @description Lee el feed semanal M2.5+ y filtra por tiempo y magnitud. nearby.js recorta luego por distancia.
 * @params {object} query - minMagnitude y lookbackHours.
 */
async function searchFeed(query) {
  const { body, elapsedMs } = await fetchJson(config.usgsFeedUrl);
  const minTime = Date.now() - query.lookbackHours * 60 * 60 * 1000;
  const events = mapFeatures(body).filter(function (event) {
    return (
      event.magnitude >= query.minMagnitude &&
      event.originTime &&
      event.originTime.getTime() >= minTime
    );
  });
  logger.info("usgs_feed_ok", { elapsedMs: elapsedMs, count: events.length });
  return events;
}

/**
 * @function searchNearby
 * @description USGS: FDSN primero; si Lambda lo bloquea o cae, usa el feed GeoJSON.
 * @params {object} query - Filtros de búsqueda.
 */
async function searchNearby(query) {
  logger.info("usgs_query", {
    latitude: query.latitude,
    longitude: query.longitude,
    radiusKm: query.radiusKm,
    minMagnitude: query.minMagnitude,
  });
  try {
    return await searchFdsn(query);
  } catch (error) {
    logger.warn("usgs_fdsn_fail", { error: error.message });
    return searchFeed(query);
  }
}

module.exports = { searchNearby, mapUsgsFeature };
