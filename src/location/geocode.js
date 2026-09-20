/**
 * @class Geocoder
 * @description Convierte la dirección del Echo en latitud/longitud. Usa Open-Meteo primero porque Nominatim suele bloquear las IPs de AWS Lambda; Nominatim queda de respaldo. Si ambos fallan y hay una ciudad colombiana conocida, usa un centro aproximado.
 */
const { config } = require("../config");
const { fetchJson, withQuery } = require("../http");
const { logger } = require("../logger");

const COLOMBIA_CITY_CENTERS = {
  bogota: { latitude: 4.711, longitude: -74.072, label: "Bogotá, Colombia" },
  medellin: { latitude: 6.244, longitude: -75.581, label: "Medellín, Colombia" },
  cali: { latitude: 3.451, longitude: -76.532, label: "Cali, Colombia" },
  barranquilla: { latitude: 10.968, longitude: -74.781, label: "Barranquilla, Colombia" },
  cartagena: { latitude: 10.391, longitude: -75.479, label: "Cartagena, Colombia" },
  bucaramanga: { latitude: 7.119, longitude: -73.123, label: "Bucaramanga, Colombia" },
  pereira: { latitude: 4.813, longitude: -75.696, label: "Pereira, Colombia" },
  manizales: { latitude: 5.067, longitude: -75.517, label: "Manizales, Colombia" },
  cucuta: { latitude: 7.894, longitude: -72.504, label: "Cúcuta, Colombia" },
};

/**
 * @function buildQuery
 * @description Arma el texto de búsqueda uniendo calle, ciudad, región, código postal y país.
 * @params {object} address - Dirección que Alexa Device Address API devuelve.
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
 * @description Traduce el código ISO del dispositivo a un nombre de país. "CO" se expande a "Colombia".
 * @params {string} code - countryCode de Alexa (por ejemplo CO o US).
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
 * @description Comprueba si hay al menos ciudad, calle, región o código postal.
 * @params {object} address - Objeto de dirección de Alexa; puede ser null.
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
 * @function normalizeCityKey
 * @description Normaliza el nombre de ciudad para buscarla en la tabla de centros de Colombia.
 * @params {string} value - Ciudad o región que envió Alexa.
 */
function normalizeCityKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * @function cityFallback
 * @description Devuelve coordenadas aproximadas de ciudades grandes de Colombia si el geocoder externo falla. El radio del MVP es de cientos de km, así que el centro de la ciudad basta.
 * @params {object} address - Dirección de Alexa, para leer city o stateOrRegion.
 */
function cityFallback(address) {
  const keys = [address.city, address.stateOrRegion, address.addressLine1]
    .filter(Boolean)
    .map(normalizeCityKey);

  for (const key of keys) {
    if (COLOMBIA_CITY_CENTERS[key]) {
      return Object.assign({}, COLOMBIA_CITY_CENTERS[key], { query: key, source: "city-fallback" });
    }
    const hit = Object.keys(COLOMBIA_CITY_CENTERS).find((city) => key.includes(city));
    if (hit) {
      return Object.assign({}, COLOMBIA_CITY_CENTERS[hit], { query: key, source: "city-fallback" });
    }
  }
  return null;
}

/**
 * @function geocodeOpenMeteo
 * @description Geocodifica con Open-Meteo (permite llamadas desde AWS). Busca por ciudad, que es lo que suele traer Alexa.
 * @params {object} address - Dirección de Alexa.
 */
async function geocodeOpenMeteo(address) {
  const name = address.city || address.stateOrRegion || address.addressLine1;
  if (!name) {
    return null;
  }
  const url = withQuery(config.openMeteoGeocodeUrl, {
    name: name,
    count: "1",
    language: "es",
    format: "json",
    country: String(address.countryCode || "").toUpperCase() === "CO" ? "CO" : undefined,
  });

  const { body, elapsedMs } = await fetchJson(url);
  const hit = body && Array.isArray(body.results) ? body.results[0] : null;
  if (!hit) {
    return null;
  }
  const latitude = Number(hit.latitude);
  const longitude = Number(hit.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  logger.info("geocode_openmeteo_ok", { elapsedMs, name: hit.name || name });
  return {
    latitude,
    longitude,
    label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
    query: name,
    source: "open-meteo",
  };
}

/**
 * @function geocodeNominatim
 * @description Respaldo Nominatim. En Lambda de Amazon a menudo falla por política de uso de OSM; por eso no es el geocoder principal.
 * @params {object} address - Dirección de Alexa.
 */
async function geocodeNominatim(address) {
  const query = buildQuery(address);
  const nominatimBase =
    config.nominatimUrl.charAt(config.nominatimUrl.length - 1) === "/"
      ? config.nominatimUrl + "search"
      : config.nominatimUrl + "/search";
  const url = withQuery(nominatimBase, {
    format: "jsonv2",
    limit: "1",
    q: query,
    countrycodes: address.countryCode ? String(address.countryCode).toLowerCase() : undefined,
  });

  const { body, elapsedMs } = await fetchJson(url);
  if (!Array.isArray(body) || body.length === 0) {
    return null;
  }
  const hit = body[0];
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  logger.info("geocode_nominatim_ok", { elapsedMs, label: hit.display_name || null });
  return {
    latitude,
    longitude,
    label: hit.display_name || query,
    query,
    source: "nominatim",
  };
}

/**
 * @function geocodeAddress
 * @description Convierte la dirección del Echo en coordenadas. Orden: Open-Meteo → Nominatim → centro de ciudad colombiana conocida.
 * @params {object} address - Dirección del Device Address API.
 */
async function geocodeAddress(address) {
  if (!isUsableAddress(address)) {
    const error = new Error("Address is too incomplete to geocode");
    error.code = "INCOMPLETE_ADDRESS";
    throw error;
  }

  logger.info("geocode_request", {
    hasStreet: Boolean(address.addressLine1),
    city: address.city || null,
    countryCode: address.countryCode || null,
  });

  try {
    const openMeteo = await geocodeOpenMeteo(address);
    if (openMeteo) {
      return openMeteo;
    }
  } catch (error) {
    logger.warn("geocode_openmeteo_fail", { error: error.message });
  }

  try {
    const nominatim = await geocodeNominatim(address);
    if (nominatim) {
      return nominatim;
    }
  } catch (error) {
    logger.warn("geocode_nominatim_fail", { error: error.message });
  }

  const fallback = cityFallback(address);
  if (fallback) {
    logger.warn("geocode_city_fallback", { label: fallback.label });
    return fallback;
  }

  const error = new Error("Geocoder returned no results");
  error.code = "GEOCODE_NOT_FOUND";
  throw error;
}

module.exports = {
  geocodeAddress,
  isUsableAddress,
  buildQuery,
  cityFallback,
};
