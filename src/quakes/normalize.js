/**
 * @class EarthquakeNormalizer
 * @description Define el modelo común EarthquakeEvent. Cada adapter entrega campos distintos; aquí se unifican tipos (números, Date) y se descartan eventos sin magnitud, coordenadas u origen, para no hablar datos incompletos.
 */
/**
 * @function isoHoursAgo
 * @description Devuelve un timestamp ISO hacia atrás (sin milisegundos) para el parámetro starttime de FDSN.
 * @params {number} hours - Horas a restar (LOOKBACK_HOURS). Define la ventana “sismos recientes” que Alexa va a narrar.
 */
function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * @function asNumber
 * @description Convierte magnitudes, coordenadas o profundidad a number o null. Las APIs a veces mandan strings; null permite filtrar eventos inválidos.
 * @params {*} value - Valor crudo del GeoJSON (mag, lat, lon, depth).
 */
function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @function asDate
 * @description Normaliza tiempos ISO o epoch USGS (ms) a Date. El origen es el instante canónico del evento para hablarlo y para deduplicar.
 * @params {string|number} value - Hora de origen o de actualización según la fuente.
 */
function asDate(value) {
  if (!value && value !== 0) {
    return null;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @function normalizeEvent
 * @description Traduce cualquier fuente al modelo común EarthquakeEvent. Así EMSC y USGS no contaminan el resto de la skill.
 * @params {object} fields - Campos ya extraídos por el adapter.
 * @params {string} fields.source - Nombre de la agencia (EMSC o USGS) para atribución y desempate.
 * @params {string} fields.sourceEventId - ID original de la fuente, para no colisionar IDs entre catálogos.
 * @params {number} fields.magnitude - Magnitud publicada; no se recalcula.
 * @params {number} fields.latitude - Latitud del epicentro.
 * @params {number} fields.longitude - Longitud del epicentro.
 * @params {number} fields.depthKm - Profundidad en km (EMSC a veces manda profundidad negativa en GeoJSON).
 * @params {string|number|Date} fields.originTime - Instante del origen sísmico.
 * @params {string|number|Date} fields.updateTime - Última revisión del catálogo.
 * @params {string} fields.locationDescription - Texto de lugar (Flinn-Engdahl o place USGS) para el mensaje hablado.
 * @params {string} fields.eventType - Tipo de evento; se espera earthquake.
 * @params {string} fields.status - automatic/reviewed: influye en qué origen se conserva al deduplicar.
 * @params {string} fields.magnitudeType - Tipo de magnitud (mb, mww, etc.) por trazabilidad.
 * @params {object} fields.rawData - Feature original, por si hay que auditar sin volver a llamar la API.
 */
function normalizeEvent({
  source,
  sourceEventId,
  magnitude,
  latitude,
  longitude,
  depthKm,
  originTime,
  updateTime,
  locationDescription,
  eventType,
  status,
  magnitudeType,
  rawData,
}) {
  return {
    id: `${source}:${sourceEventId}`,
    source,
    sourceEventId: String(sourceEventId),
    magnitude: asNumber(magnitude),
    magnitudeType: magnitudeType || null,
    latitude: asNumber(latitude),
    longitude: asNumber(longitude),
    depthKm: asNumber(depthKm),
    originTime: asDate(originTime),
    updateTime: asDate(updateTime),
    locationDescription: locationDescription || "",
    eventType: eventType || "earthquake",
    status: status || "unknown",
    rawData,
  };
}

/**
 * @function isValidEvent
 * @description Descarta features incompletos. Sin magnitud, coordenadas u origen no se puede hablar un sismo cercano de forma honesta.
 * @params {object} event - EarthquakeEvent ya normalizado.
 */
function isValidEvent(event) {
  return (
    event &&
    Number.isFinite(event.magnitude) &&
    Number.isFinite(event.latitude) &&
    Number.isFinite(event.longitude) &&
    event.originTime instanceof Date
  );
}

module.exports = {
  isoHoursAgo,
  normalizeEvent,
  isValidEvent,
};
