/**
 * @class EmscAdapter
 * @description Adapter del Euro-Mediterranean Seismological Centre. Traduce el FDSN GeoJSON de SeismicPortal al modelo EarthquakeEvent y busca por círculo (lat, lon, radio en grados). Fuente near-real-time principal del MVP; no sustituye al SGC.
 */
const { config } = require("../config");
const { fetchJson } = require("../http");
const { kmToDegrees } = require("../geo/distance");
const { isoHoursAgo, normalizeEvent, isValidEvent } = require("../quakes/normalize");
const { logger } = require("../logger");

/**
 * @function mapEmscFeature
 * @description Mapea un Feature GeoJSON de EMSC al modelo común. Las coordenadas EMSC son [lon, lat, depth]; depth puede venir negativo y se toma valor absoluto.
 * @params {object} feature - Feature de SeismicPortal (properties.unid, mag, time, flynn_region, geometry).
 */
function mapEmscFeature(feature) {
  const props = feature.properties || {};
  const coords = feature.geometry && feature.geometry.coordinates;
  const longitude = Array.isArray(coords) ? coords[0] : props.lon;
  const latitude = Array.isArray(coords) ? coords[1] : props.lat;
  const depth = Array.isArray(coords) ? Math.abs(coords[2]) : props.depth;

  return normalizeEvent({
    source: "EMSC",
    sourceEventId: props.unid || feature.id,
    magnitude: props.mag,
    magnitudeType: props.magtype,
    latitude,
    longitude,
    depthKm: depth,
    originTime: props.time,
    updateTime: props.lastupdate,
    locationDescription: props.flynn_region,
    eventType: props.evtype,
    status: "automatic",
    rawData: feature,
  });
}

/**
 * @function searchNearby
 * @description Consulta el FDSN-event de EMSC por círculo (lat, lon, maxradius en grados). Es la fuente near-real-time principal del MVP junto a USGS.
 * @params {object} query - Filtros de búsqueda.
 * @params {number} query.latitude - Latitud del Echo, para el centro del círculo.
 * @params {number} query.longitude - Longitud del Echo.
 * @params {number} query.radiusKm - Radio en km; se convierte a grados porque así lo pide EMSC.
 * @params {number} query.minMagnitude - Magnitud mínima del catálogo.
 * @params {number} query.lookbackHours - Inicio de la ventana temporal (starttime).
 */
async function searchNearby({ latitude, longitude, radiusKm, minMagnitude, lookbackHours }) {
  const url = new URL(config.emscFdsnUrl);
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("maxradius", String(kmToDegrees(radiusKm)));
  url.searchParams.set("minmag", String(minMagnitude));
  url.searchParams.set("starttime", isoHoursAgo(lookbackHours));
  url.searchParams.set("limit", "20");
  url.searchParams.set("orderby", "time");

  logger.info("emsc_query", { latitude, longitude, radiusKm, minMagnitude });
  const { body, elapsedMs } = await fetchJson(url.toString());
  const features = (body && body.features) || [];
  const events = features.map(mapEmscFeature).filter(isValidEvent);
  logger.info("emsc_ok", { elapsedMs, count: events.length });
  return events;
}

module.exports = { searchNearby, mapEmscFeature };
