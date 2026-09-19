/**
 * @class UsgsAdapter
 * @description Adapter del United States Geological Survey. Consulta el Earthquake Catalog (maxradiuskm en kilómetros) y mapea GeoJSON USGS al modelo común. Fuente internacional de respaldo; fuera de EE.UU. suele llegar más tarde que EMSC.
 */
const { config } = require("../config");
const { fetchJson } = require("../http");
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
    sourceEventId: feature.id || `${props.net}${props.code}`,
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
 * @function searchNearby
 * @description Consulta el FDSN de USGS con maxradiuskm (la API sí acepta kilómetros). Fuente internacional de respaldo; suele ser más lenta fuera de EE.UU.
 * @params {object} query - Filtros de búsqueda.
 * @params {number} query.latitude - Latitud del centro.
 * @params {number} query.longitude - Longitud del centro.
 * @params {number} query.radiusKm - Radio en km; USGS lo usa directo en maxradiuskm.
 * @params {number} query.minMagnitude - Magnitud mínima.
 * @params {number} query.lookbackHours - Ventana hacia atrás para starttime.
 */
async function searchNearby({ latitude, longitude, radiusKm, minMagnitude, lookbackHours }) {
  const url = new URL(config.usgsFdsnUrl);
  url.searchParams.set("format", "geojson");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("maxradiuskm", String(radiusKm));
  url.searchParams.set("minmagnitude", String(minMagnitude));
  url.searchParams.set("starttime", isoHoursAgo(lookbackHours));
  url.searchParams.set("limit", "20");
  url.searchParams.set("orderby", "time");

  logger.info("usgs_query", { latitude, longitude, radiusKm, minMagnitude });
  const { body, elapsedMs } = await fetchJson(url.toString());
  const features = (body && body.features) || [];
  const events = features.map(mapUsgsFeature).filter(isValidEvent);
  logger.info("usgs_ok", { elapsedMs, count: events.length });
  return events;
}

module.exports = { searchNearby, mapUsgsFeature };
