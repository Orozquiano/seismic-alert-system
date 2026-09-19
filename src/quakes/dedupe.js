/**
 * @class EventDeduper
 * @description Detecta si EMSC y USGS reportaron el mismo sismo (tiempo, epicentro, magnitud) y deja un solo registro. Evita que Alexa lea dos veces el mismo terremoto. Los umbrales son de ingeniería, no una norma del SGC.
 */
const { haversineKm } = require("../geo/distance");

const DEFAULTS = {
  maxOriginDeltaMs: 90 * 1000,
  maxEpicenterKm: 80,
  maxMagnitudeDelta: 1,
};

/**
 * @function sameEvent
 * @description Estima si dos reportes son el mismo sismo (tiempo, epicentro, magnitud). EMSC y USGS suelen publicar el mismo evento con IDs distintos; SGC no entra en EventID FDSN.
 * @params {object} a - Primer EarthquakeEvent.
 * @params {object} b - Segundo EarthquakeEvent.
 * @params {object} options - Umbrales de ingeniería (no son norma sísmica oficial).
 * @params {number} options.maxOriginDeltaMs - Diferencia máxima de origen; 90 s cubre desfaces de publicación.
 * @params {number} options.maxEpicenterKm - Distancia máxima entre epicentros para no fusionar sismos distintos.
 * @params {number} options.maxMagnitudeDelta - Holgura de magnitud porque las agencias miden distinto (mb vs mww).
 */
function sameEvent(a, b, options = DEFAULTS) {
  const dt = Math.abs(a.originTime.getTime() - b.originTime.getTime());
  if (dt > options.maxOriginDeltaMs) {
    return false;
  }
  const distance = haversineKm(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude }
  );
  if (distance > options.maxEpicenterKm) {
    return false;
  }
  return Math.abs(a.magnitude - b.magnitude) <= options.maxMagnitudeDelta;
}

/**
 * @function prefer
 * @description Elige qué registro sobrevive al fusionar. Prioriza revisado y un place más parlable (USGS suele traer ciudad).
 * @params {object} a - Evento ya guardado en la lista única.
 * @params {object} b - Evento nuevo candidato a reemplazarlo.
 */
function prefer(a, b) {
  const rank = (event) => {
    let score = 0;
    if (event.status === "reviewed" || event.status === "manual") {
      score += 3;
    }
    if (event.locationDescription && event.locationDescription.length > 12) {
      score += 1;
    }
    if (event.source === "USGS") {
      score += 1;
    }
    return score;
  };
  return rank(a) >= rank(b) ? a : b;
}

/**
 * @function dedupeEvents
 * @description Reduce la lista para que Alexa no cuente dos veces el mismo terremoto.
 * @params {object[]} events - Eventos de una o más fuentes.
 * @params {object} options - Mismos umbrales que sameEvent; se parametrizan para poder ajustarlos sin reescribir la lógica.
 */
function dedupeEvents(events, options = DEFAULTS) {
  const unique = [];
  for (const event of events) {
    const index = unique.findIndex((candidate) => sameEvent(candidate, event, options));
    if (index === -1) {
      unique.push(event);
    } else {
      unique[index] = prefer(unique[index], event);
    }
  }
  return unique;
}

module.exports = { sameEvent, dedupeEvents };
