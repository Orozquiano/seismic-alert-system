/**
 * @class HttpClient
 * @description Cliente HTTP GET JSON compartido por EMSC, USGS, Nominatim y, si aplica, otras APIs. Aplica timeout corto (límite de 8 s de Alexa), User-Agent identificable y trata HTTP 204 / cuerpo vacío como lista sin eventos.
 */
const { config } = require("./config");
const { logger } = require("./logger");

/**
 * @function fetchJson
 * @description Hace GET JSON con timeout, User-Agent identificable y manejo de HTTP 204 (EMSC/USGS a veces no devuelven cuerpo cuando no hay eventos). Alexa exige responder en ~8 s, por eso el abort es obligatorio.
 * @params {string} url - URL completa del catálogo o geocoder. Se pasa ya construida para no acoplar este cliente a una fuente.
 * @params {object} options - Ajustes opcionales de la petición.
 * @params {number} options.timeoutMs - Tope de espera en ms; por defecto el de config para no bloquear la skill.
 * @params {object} options.headers - Cabeceras extra (por ejemplo Authorization de Alexa) sin perder Accept ni User-Agent.
 */
async function fetchJson(url, { timeoutMs = config.httpTimeoutMs, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": config.userAgent,
        ...headers,
      },
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - started;
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} for ${url}`);
      error.status = response.status;
      error.elapsedMs = elapsedMs;
      throw error;
    }

    if (response.status === 204) {
      return { body: { type: "FeatureCollection", features: [] }, status: 204, elapsedMs };
    }

    const text = await response.text();
    if (!text.trim()) {
      return { body: { type: "FeatureCollection", features: [] }, status: response.status, elapsedMs };
    }

    const body = JSON.parse(text);
    return { body, status: response.status, elapsedMs };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`Timeout after ${timeoutMs}ms for ${url}`);
      timeoutError.code = "ETIMEDOUT";
      timeoutError.elapsedMs = Date.now() - started;
      logger.warn("http_timeout", { url, timeoutMs });
      throw timeoutError;
    }
    logger.warn("http_error", {
      url,
      status: error.status || null,
      error: error.message,
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchJson };
