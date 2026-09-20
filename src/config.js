/**
 * @class Config
 * @description Centraliza la configuración del MVP (radio, magnitud, URLs, timeouts, User-Agent). Todo sale de variables de entorno para no hardcodear secretos ni umbrales en el código. Se carga al arrancar Lambda o los scripts locales.
 */
require("./loadEnv");

/**
 * @function numberEnv
 * @description Lee una variable de entorno y la convierte a número. Si no existe o no es numérica, usa el valor por defecto para no romper la skill.
 * @params {string} name - Nombre de la variable de entorno, porque cada ajuste (radio, magnitud, timeout) se configura por .env y no en el código.
 * @params {number} fallback - Valor de respaldo cuando la variable falta o es inválida, para que el MVP tenga umbrales seguros.
 */
function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * @function stringEnv
 * @description Lee una variable de entorno de texto y recorta espacios. Evita URLs o User-Agent vacíos.
 * @params {string} name - Nombre de la variable de entorno (por ejemplo USER_AGENT o una URL de API).
 * @params {string} fallback - Texto por defecto si la variable no está definida, para identificar el cliente ante EMSC, USGS, Open-Meteo y Nominatim.
 */
function stringEnv(name, fallback) {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

const config = {
  lookbackHours: numberEnv("LOOKBACK_HOURS", 48),
  searchRadiusKm: numberEnv("SEARCH_RADIUS_KM", 250),
  minMagnitude: numberEnv("MIN_MAGNITUDE", 3),
  maxEventsToSpeak: numberEnv("MAX_EVENTS_TO_SPEAK", 3),
  httpTimeoutMs: numberEnv("HTTP_TIMEOUT_MS", 5000),
  userAgent: stringEnv(
    "USER_AGENT",
    "SismosCercanosAlexa/1.0 (+https://developer.amazon.com)"
  ),
  nominatimUrl: stringEnv("NOMINATIM_URL", "https://nominatim.openstreetmap.org"),
  openMeteoGeocodeUrl: stringEnv(
    "OPEN_METEO_GEOCODE_URL",
    "https://geocoding-api.open-meteo.com/v1/search"
  ),
  emscFdsnUrl: stringEnv(
    "EMSC_FDSN_URL",
    "https://www.seismicportal.eu/fdsnws/event/1/query"
  ),
  usgsFdsnUrl: stringEnv(
    "USGS_FDSN_URL",
    "https://earthquake.usgs.gov/fdsnws/event/1/query"
  ),
  usgsFeedUrl: stringEnv(
    "USGS_FEED_URL",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
  ),
  defaultLat: numberEnv("DEFAULT_LAT", 4.711),
  defaultLon: numberEnv("DEFAULT_LON", -74.072),
  defaultTimezone: stringEnv("DEFAULT_TIMEZONE", "America/Bogota"),
  skillLocale: "es-US",
};

module.exports = { config };
