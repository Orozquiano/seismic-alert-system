/**
 * @class Geocoder
 * @description Convierte la dirección configurada en la app Alexa en latitud y longitud con Nominatim (OpenStreetMap). El Echo no tiene GPS; sin este paso no se puede consultar un radio alrededor del hogar. La dirección no se guarda: solo vive en la petición.
 */
const { config } = require("../config");
const { fetchJson } = require("../http");
const { logger } = require("../logger");

/**
 * @function buildQuery
 * @description Arma el texto de búsqueda para Nominatim uniendo calle, ciudad, región, código postal y país. Nominatim geocodifica mejor una consulta estructurada que un país suelto.
 * @params {object} address - Dirección que Alexa Device Address API devuelve (addressLine1, city, stateOrRegion, postalCode, countryCode).
 */
function buildQuery(address) {
  const parts = [
    address.addressLine1,
    address.city,
    address.stateOrRegion,
    address.postalCode,
    countryName(address.countryCode),
  ].filter((part) => part && String(part).trim());

  return parts.join(", ");
}

/**
 * @function countryName
 * @description Traduce el código ISO del dispositivo a un nombre que Nominatim reconoce. "CO" se expande a "Colombia".
 * @params {string} code - countryCode de Alexa (por ejemplo CO o US), porque el Echo en Colombia suele reportar ISO-2, no el nombre del país.
 */
function countryName(code) {
  if (!code) {
    return "";
  }
  const normalized = String(code).toUpperCase();
  if (normalized === "CO") {
    return "Colombia";
  }
  return normalized;
}

/**
 * @function isUsableAddress
 * @description Comprueba si hay al menos ciudad, calle, región o código postal. Solo el país no basta para decir “cerca de esta ubicación”.
 * @params {object} address - Objeto de dirección de Alexa; puede ser null si el usuario no configuró nada.
 */
function isUsableAddress(address) {
  if (!address) {
    return false;
  }
  return Boolean(
    address.addressLine1 || address.city || address.postalCode || address.stateOrRegion
  );
}

/**
 * @function geocodeAddress
 * @description Convierte la dirección del Echo en latitud/longitud con Nominatim. No se guarda la dirección: se usa solo en esta petición.
 * @params {object} address - Dirección del Device Address API. Se geocodifica porque EMSC y USGS filtran por coordenadas, no por texto.
 */
async function geocodeAddress(address) {
  if (!isUsableAddress(address)) {
    const error = new Error("Address is too incomplete to geocode");
    error.code = "INCOMPLETE_ADDRESS";
    throw error;
  }

  const query = buildQuery(address);
  const url = new URL("/search", config.nominatimUrl);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  if (address.countryCode) {
    url.searchParams.set("countrycodes", String(address.countryCode).toLowerCase());
  }

  logger.info("geocode_request", {
    hasStreet: Boolean(address.addressLine1),
    city: address.city || null,
    countryCode: address.countryCode || null,
  });

  const { body, elapsedMs } = await fetchJson(url.toString());
  if (!Array.isArray(body) || body.length === 0) {
    const error = new Error("Geocoder returned no results");
    error.code = "GEOCODE_NOT_FOUND";
    throw error;
  }

  const hit = body[0];
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error("Geocoder returned invalid coordinates");
    error.code = "GEOCODE_INVALID";
    throw error;
  }

  logger.info("geocode_ok", { elapsedMs, label: hit.display_name || null });

  return {
    latitude,
    longitude,
    label: hit.display_name || query,
    query,
  };
}

module.exports = {
  geocodeAddress,
  isUsableAddress,
  buildQuery,
};
