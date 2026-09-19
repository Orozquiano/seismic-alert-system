/**
 * @class SpanishSpeech
 * @description Genera el texto que Alexa pronuncia en español (es-US / redacción es-CO). Describe sismos ya registrados, nunca predicciones, y añade el descargo de que no es alerta temprana ni canal oficial.
 */
const { config } = require("../config");

const DISCLAIMER =
  "Esta información corresponde a sismos ya registrados. No predice terremotos y no reemplaza los canales oficiales.";

/**
 * @function formatMagnitude
 * @description Pasa la magnitud a “4 punto 2” para que Alexa no lea “cuatro punto dos” de forma ambigua ni trunque decimales.
 * @params {number} value - Magnitud numérica del catálogo.
 */
function formatMagnitude(value) {
  return value.toFixed(1).replace(".", " punto ");
}

/**
 * @function formatKm
 * @description Redondea kilómetros a entero ≥ 1. Evita “0 kilómetros” cuando el epicentro cae casi encima de la dirección.
 * @params {number} value - Distancia o profundidad en km.
 */
function formatKm(value) {
  return String(Math.max(1, Math.round(value)));
}

/**
 * @function formatWhen
 * @description Formatea la hora del origen en español (es-CO) usando la zona del Echo. El usuario oye fecha local, no UTC.
 * @params {Date} date - originTime del evento.
 * @params {string} timeZone - IANA timezone del dispositivo (America/Bogota si Alexa no la entrega).
 */
function formatWhen(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: timeZone || config.defaultTimezone,
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * @function titleCase
 * @description Capitaliza regiones EMSC en MAYÚSCULAS (“COLOMBIA” → “Colombia”) para que suenen naturales.
 * @params {string} value - Texto de lugar en mayúsculas.
 */
function titleCase(value) {
  return value.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/**
 * @function describePlace
 * @description Arma el complemento de lugar (“en Colombia”, “29 km SSW of Sipí…”). No inventa ciudades que la fuente no publicó.
 * @params {object} event - Evento con locationDescription.
 */
function describePlace(event) {
  if (!event.locationDescription) {
    return "con epicentro no detallado";
  }
  const raw = event.locationDescription.trim();
  const place = /[a-z]/.test(raw) ? raw : titleCase(raw);
  if (/^(en|cerca)\b/i.test(place) || /^\d/.test(place)) {
    return place;
  }
  return `en ${place}`;
}

/**
 * @function describeEvent
 * @description Frase de un sismo: magnitud, distancia, lugar, hora y profundidad. Siempre en pasado (“se registró”), nunca predicción.
 * @params {object} event - Evento con distanceKm y campos normalizados.
 * @params {string} timeZone - Zona horaria para formatWhen.
 */
function describeEvent(event, timeZone) {
  const depth =
    Number.isFinite(event.depthKm) && event.depthKm > 0
      ? `, a una profundidad de ${formatKm(event.depthKm)} kilómetros`
      : "";

  return `un sismo de magnitud ${formatMagnitude(event.magnitude)}, a unos ${formatKm(
    event.distanceKm
  )} kilómetros de esta ubicación, ${describePlace(event)}, el ${formatWhen(
    event.originTime,
    timeZone
  )}${depth}`;
}

/**
 * @function nearbySpeech
 * @description Construye el texto completo que Alexa va a decir, incluyendo el descargo de que no es alerta temprana.
 * @params {object} payload - Datos ya filtrados para hablar.
 * @params {object[]} payload.events - Sismos cercanos ordenados.
 * @params {object} payload.query - Radio, magnitud mínima y horas, para el mensaje de “no hay eventos”.
 * @params {string} payload.timeZone - Zona horaria del dispositivo.
 */
function nearbySpeech({ events, query, timeZone }) {
  if (!events.length) {
    return (
      `No se registraron sismos de magnitud ${formatMagnitude(query.minMagnitude)} o superior ` +
      `en un radio de ${formatKm(query.radiusKm)} kilómetros durante las últimas ${query.lookbackHours} horas. ` +
      DISCLAIMER
    );
  }

  const top = events.slice(0, config.maxEventsToSpeak);
  if (top.length === 1) {
    return `Se registró ${describeEvent(top[0], timeZone)}. ${DISCLAIMER}`;
  }

  const first = `Se registraron ${top.length} sismos cercanos. El más cercano fue ${describeEvent(
    top[0],
    timeZone
  )}.`;
  const rest = top
    .slice(1)
    .map((event) => `El siguiente, ${describeEvent(event, timeZone)}`)
    .join(". ");

  return `${first} ${rest}. ${DISCLAIMER}`;
}

const strings = {
  welcomeAndAsk:
    "Puedes preguntarme si hay sismos cerca. Para ubicarlos uso la dirección configurada en la aplicación Alexa.",
  help:
    "Dime: si hay sismos cerca, o últimos temblores. Uso la dirección de este dispositivo y consulto catálogos sísmicos publicados. No es un sistema de alerta temprana.",
  bye: "Hasta luego.",
  fallback: "No entendí eso. Prueba diciendo: si hay sismos cerca.",
  permissionNeeded:
    "Para decirte sismos cercanos necesito permiso para usar la dirección de este dispositivo. Ábrelo en la aplicación Alexa y vuelve a intentarlo.",
  incompleteAddress:
    "La dirección de este dispositivo está incompleta. Agrégala en la aplicación Alexa, en la configuración del Echo, e inténtalo de nuevo.",
  geocodeFailed:
    "No pude ubicar la dirección configurada en este dispositivo. Verifícala en la aplicación Alexa e inténtalo de nuevo.",
  sourcesDown:
    "En este momento no pude consultar las fuentes sísmicas. Inténtalo de nuevo en unos minutos.",
  genericError:
    "Hubo un problema al consultar los sismos. Inténtalo de nuevo en unos minutos.",
};

module.exports = {
  DISCLAIMER,
  nearbySpeech,
  describeEvent,
  describePlace,
  strings,
};
