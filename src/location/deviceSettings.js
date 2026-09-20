/**
 * @class DeviceSettings
 * @description Acceso oficial a Device Address y zona horaria de Alexa. Pide permiso de dirección, traduce 403 a PERMISSION_DENIED y ofrece coordenadas de prueba solo cuando ALLOW_DEFAULT_LOCATION está activo (scripts locales, no producción).
 */
const { config } = require("../config");
const { logger } = require("../logger");
const { fetchResponse, withTimeout } = require("../http");

const FULL_ADDRESS_PERMISSION = "read::alexa:device:all:address";

/**
 * @function system
 * @description Lee context.System del envelope. Si falta, Device Address no se puede llamar.
 * @params {object} handlerInput - Envoltorio con requestEnvelope de Alexa.
 */
function system(handlerInput) {
  return handlerInput && handlerInput.requestEnvelope && handlerInput.requestEnvelope.context
    ? handlerInput.requestEnvelope.context.System
    : null;
}

/**
 * @function apiHost
 * @description Obtiene el host regional de Alexa (api.amazonalexa.com, etc.) del propio request. Hay que usar el endpoint del envelope, no uno fijo, porque depende de la región de la cuenta.
 * @params {object} handlerInput - Envoltorio con requestEnvelope de Alexa.
 */
function apiHost(handlerInput) {
  const sys = system(handlerInput);
  return sys && sys.apiEndpoint;
}

/**
 * @function deviceId
 * @description Lee el deviceId del Echo que habló. La Device Settings API identifica el aparato, no al usuario Amazon, para traer la dirección de ese dispositivo.
 * @params {object} handlerInput - Envoltorio con requestEnvelope de Alexa.
 */
function deviceId(handlerInput) {
  const sys = system(handlerInput);
  return sys && sys.device && sys.device.deviceId;
}

/**
 * @function accessToken
 * @description Token de corta duración que Alexa envía en cada petición. Autoriza Device Address y zona horaria sin guardar credenciales.
 * @params {object} handlerInput - Envoltorio con requestEnvelope de Alexa.
 */
function accessToken(handlerInput) {
  const sys = system(handlerInput);
  return sys && sys.apiAccessToken;
}

/**
 * @function getJsonSetting
 * @description Llama a Device Settings REST y traduce 403 a PERMISSION_DENIED para pedir consentimiento. El timeout va con Promise.race (el editor de Alexa-hosted no define AbortController).
 * @params {object} handlerInput - Envoltorio Alexa con apiEndpoint, deviceId y token.
 * @params {string} path - Ruta del setting (dirección o zona horaria) porque son recursos distintos de la misma API.
 */
async function getJsonSetting(handlerInput, path) {
  const host = apiHost(handlerInput);
  const id = deviceId(handlerInput);
  const token = accessToken(handlerInput);
  if (!host || !id || !token) {
    const error = new Error("Missing Alexa System.apiEndpoint, deviceId or token");
    error.code = "DEVICE_CONTEXT_MISSING";
    throw error;
  }

  const url = `${host}${path}`;

  try {
    const timeoutMs = 2500;
    const response = await withTimeout(
      fetchResponse(url, {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          "User-Agent": config.userAgent || "SismosCercanosAlexa/1.0",
        },
        timeoutMs: timeoutMs,
      }),
      timeoutMs,
      "Device settings timeout for " + path
    );

    if (response.status === 403) {
      const error = new Error("Device settings permission denied");
      error.code = "PERMISSION_DENIED";
      error.status = 403;
      throw error;
    }

    if (response.status === 204 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = new Error(`Device settings HTTP ${response.status}`);
      error.code = "DEVICE_SETTINGS_FAILED";
      error.status = response.status;
      throw error;
    }

    return response.json();
  } catch (error) {
    if (!error.code) {
      error.code = "DEVICE_SETTINGS_FAILED";
    }
    throw error;
  }
}

/**
 * @function getDeviceAddress
 * @description Pide la dirección completa configurada en la app Alexa. El Echo fijo no tiene GPS; esta es la única ubicación oficial.
 * @params {object} handlerInput - Envoltorio Alexa; se necesita para deviceId y el token de permiso.
 */
async function getDeviceAddress(handlerInput) {
  const id = deviceId(handlerInput);
  return getJsonSetting(handlerInput, `/v1/devices/${id}/settings/address`);
}

/**
 * @function getDeviceTimeZone
 * @description Pide la zona horaria del dispositivo para hablar la hora local del sismo. Si falla, usa America/Bogota porque el MVP apunta a Colombia.
 * @params {object} handlerInput - Envoltorio Alexa con el mismo token de la petición.
 */
async function getDeviceTimeZone(handlerInput) {
  try {
    const id = deviceId(handlerInput);
    const timezone = await getJsonSetting(
      handlerInput,
      `/v2/devices/${id}/settings/System.timeZone`
    );
    if (typeof timezone === "string" && timezone) {
      return timezone;
    }
    return config.defaultTimezone;
  } catch (error) {
    logger.warn("timezone_fallback", { error: error.message });
    return config.defaultTimezone;
  }
}

/**
 * @function hasDefaultCoordinates
 * @description Indica si hay lat/lon de prueba en el entorno. Solo se usa en scripts locales, nunca como GPS real del Echo.
 */
function hasDefaultCoordinates() {
  return Number.isFinite(config.defaultLat) && Number.isFinite(config.defaultLon);
}

/**
 * @function defaultLocation
 * @description Arma una ubicación sintética desde DEFAULT_LAT/DEFAULT_LON para simular la skill sin Device Address.
 */
function defaultLocation() {
  return {
    latitude: config.defaultLat,
    longitude: config.defaultLon,
    label: "Bogotá, Colombia",
    query: "DEFAULT_LAT/DEFAULT_LON",
    source: "env",
  };
}

module.exports = {
  FULL_ADDRESS_PERMISSION,
  getDeviceAddress,
  getDeviceTimeZone,
  hasDefaultCoordinates,
  defaultLocation,
};
