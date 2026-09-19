/**
 * @class AlexaSkill
 * @description Skill de consulta por voz. Recibe LaunchRequest e intents, pide la dirección del Echo, consulta sismos cercanos y responde. No inicia audio sola: solo habla cuando el usuario abre la skill. Maneja permiso denegado, dirección incompleta y fuentes caídas.
 */
const { logger } = require("./logger");
const { geocodeAddress, isUsableAddress } = require("./location/geocode");
const {
  FULL_ADDRESS_PERMISSION,
  getDeviceAddress,
  getDeviceTimeZone,
  hasDefaultCoordinates,
  defaultLocation,
} = require("./location/deviceSettings");
const { findNearbyEarthquakes } = require("./quakes/nearby");
const { nearbySpeech, strings } = require("./speech/es");
const { config } = require("./config");

/**
 * @function requestType
 * @description Lee el tipo de request de Alexa (LaunchRequest, IntentRequest, SessionEndedRequest) para enrutar.
 * @params {object} event - Envelope JSON que Lambda recibe de ASK.
 */
function requestType(event) {
  return event && event.request && event.request.type;
}

/**
 * @function intentName
 * @description Lee el nombre del intent (NearbyQuakesIntent, AMAZON.HelpIntent, etc.).
 * @params {object} event - Envelope de Alexa; el intent solo existe en IntentRequest.
 */
function intentName(event) {
  return event && event.request && event.request.intent && event.request.intent.name;
}

/**
 * @function speakResponse
 * @description Arma la respuesta ASK 1.0 con voz y tarjeta simple. Es el único canal de salida del MVP: el usuario ya inició la sesión.
 * @params {string} text - Texto que Alexa va a pronunciar.
 * @params {object} options - Control de sesión y tarjeta.
 * @params {boolean} options.shouldEndSession - true cierra la skill tras informar; false deja el micrófono abierto (ayuda).
 * @params {string} options.cardTitle - Título de la tarjeta en Echo Show / app.
 * @params {string} options.reprompt - Pregunta de seguimiento si la sesión sigue abierta.
 */
function speakResponse(text, { shouldEndSession = true, cardTitle = "Sismos cercanos", reprompt } = {}) {
  const response = {
    outputSpeech: { type: "PlainText", text },
    card: { type: "Simple", title: cardTitle, content: text },
    shouldEndSession,
  };
  if (reprompt) {
    response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
  }
  return { version: "1.0", response };
}

/**
 * @function permissionResponse
 * @description Pide el permiso de dirección con la tarjeta oficial AskForPermissionsConsent. Sin ese permiso no hay “cerca”.
 */
function permissionResponse() {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: strings.permissionNeeded },
      card: {
        type: "AskForPermissionsConsent",
        permissions: [FULL_ADDRESS_PERMISSION],
      },
      shouldEndSession: true,
    },
  };
}

/**
 * @function resolveLocation
 * @description Obtiene lat/lon: o coordenadas de prueba (solo scripts) o Device Address + Nominatim. No persiste la dirección.
 * @params {object} handlerInput - { requestEnvelope } con token y deviceId de Alexa.
 */
async function resolveLocation(handlerInput) {
  if (hasDefaultCoordinates() && process.env.ALLOW_DEFAULT_LOCATION === "true") {
    logger.warn("using_default_location");
    return { location: defaultLocation(), timeZone: config.defaultTimezone };
  }

  const [address, timeZone] = await Promise.all([
    getDeviceAddress(handlerInput),
    getDeviceTimeZone(handlerInput),
  ]);

  if (!isUsableAddress(address)) {
    const error = new Error("Incomplete device address");
    error.code = "INCOMPLETE_ADDRESS";
    throw error;
  }

  const location = await geocodeAddress(address);
  return { location, timeZone };
}

/**
 * @function reportNearby
 * @description Flujo principal: ubica el Echo, consulta catálogos y genera el speech. Lo usan LaunchRequest y NearbyQuakesIntent.
 * @params {object} handlerInput - Envoltorio con el envelope de Alexa.
 */
async function reportNearby(handlerInput) {
  const { location, timeZone } = await resolveLocation(handlerInput);
  const result = await findNearbyEarthquakes(location);
  const speech = nearbySpeech({
    events: result.events,
    query: result.query,
    timeZone,
  });
  logger.info("speech_ready", {
    eventCount: result.events.length,
    sources: result.sourceStatus,
  });
  return speakResponse(speech);
}

/**
 * @function errorResponse
 * @description Traduce códigos internos a frases para el usuario (permiso, dirección, geocoder, fuentes). Nunca expone stack traces por voz.
 * @params {Error} error - Error con code/status lanzado por adapters o Device Settings.
 */
function errorResponse(error) {
  logger.error("skill_error", { error: error.message, code: error.code || null });
  if (error.code === "PERMISSION_DENIED" || error.status === 403) {
    return permissionResponse();
  }
  if (error.code === "INCOMPLETE_ADDRESS") {
    return speakResponse(strings.incompleteAddress);
  }
  if (error.code === "GEOCODE_NOT_FOUND" || error.code === "GEOCODE_INVALID") {
    return speakResponse(strings.geocodeFailed);
  }
  if (error.code === "SOURCES_UNAVAILABLE") {
    return speakResponse(strings.sourcesDown);
  }
  return speakResponse(strings.genericError);
}

/**
 * @function handleEvent
 * @description Enruta el request de Alexa a consulta, ayuda, stop o fallback.
 * @params {object} event - Envelope ASK completo.
 */
async function handleEvent(event) {
  const type = requestType(event);
  const intent = intentName(event);
  logger.info("request", { type, intent });

  if (type === "LaunchRequest" || (type === "IntentRequest" && intent === "NearbyQuakesIntent")) {
    return reportNearby({ requestEnvelope: event });
  }
  if (type === "IntentRequest" && intent === "AMAZON.HelpIntent") {
    return speakResponse(strings.help, { shouldEndSession: false, reprompt: strings.welcomeAndAsk });
  }
  if (
    type === "IntentRequest" &&
    (intent === "AMAZON.CancelIntent" || intent === "AMAZON.StopIntent")
  ) {
    return speakResponse(strings.bye);
  }
  if (type === "IntentRequest" && intent === "AMAZON.FallbackIntent") {
    return speakResponse(strings.fallback, { shouldEndSession: false, reprompt: strings.welcomeAndAsk });
  }
  if (type === "SessionEndedRequest") {
    return { version: "1.0", response: {} };
  }
  return speakResponse(strings.fallback, { shouldEndSession: false, reprompt: strings.welcomeAndAsk });
}

/**
 * @function handler
 * @description Punto de entrada Lambda. Captura cualquier excepción y la convierte en respuesta Alexa válida (siempre hay que devolver JSON 1.0).
 * @params {object} event - Evento Lambda enviado por Alexa Skills Kit.
 */
async function handler(event) {
  try {
    return await handleEvent(event);
  } catch (error) {
    return errorResponse(error);
  }
}

module.exports = { handler, reportNearby, speakResponse };
