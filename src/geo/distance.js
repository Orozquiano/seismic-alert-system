/**
 * @class Distance
 * @description Utilidades geodésicas: Haversine en km, conversión km→grados para EMSC y distancia hipocentral. Sirve para filtrar “sismos cerca”, ordenar resultados y correlacionar el mismo evento entre agencias.
 */
const EARTH_RADIUS_KM = 6371;

/**
 * @function toRad
 * @description Convierte grados a radianes, requerido por la fórmula de Haversine.
 * @params {number} degrees - Ángulo en grados decimales (latitud o diferencia de longitudes).
 */
function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * @function haversineKm
 * @description Calcula la distancia epicentral en km sobre la esfera terrestre. Se usa para saber si un sismo está “cerca” de la Alexa y para deduplicar orígenes de distintas agencias.
 * @params {{latitude: number, longitude: number}} from - Punto de origen (ubicación del Echo o epicentro A).
 * @params {{latitude: number, longitude: number}} to - Punto destino (epicentro B o ubicación del usuario).
 */
function haversineKm(from, to) {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * @function kmToDegrees
 * @description Aproxima kilómetros a grados de arco. EMSC FDSN pide maxradius en grados, no en km.
 * @params {number} km - Radio de búsqueda configurado en kilómetros.
 */
function kmToDegrees(km) {
  return km / 111.32;
}

/**
 * @function hypocentralDistanceKm
 * @description Distancia 3D aproximada combinando epicentro y profundidad. Queda disponible para un risk calculator futuro; el MVP habla sobre todo de distancia epicentral.
 * @params {{latitude: number, longitude: number}} from - Ubicación del usuario.
 * @params {{latitude: number, longitude: number, depthKm: number}} event - Evento con profundidad en km.
 */
function hypocentralDistanceKm(from, event) {
  const epicentral = haversineKm(from, event);
  const depthKm = Number.isFinite(event.depthKm) ? event.depthKm : 0;
  return Math.sqrt(epicentral ** 2 + depthKm ** 2);
}

module.exports = {
  haversineKm,
  kmToDegrees,
  hypocentralDistanceKm,
};
