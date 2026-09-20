/**
 * @class HttpClient
 * @description Cliente HTTP GET JSON. Usa http/https nativos (Alexa-hosted no define fetch ni a veces URL global). Timeout corto, HTTP 204 como lista vacía, IPv4 y querystring sin WHATWG URL.
 */
const dns = require("dns");
const http = require("http");
const https = require("https");
const urlLib = require("url");
const { Buffer } = require("buffer");
const { logger } = require("./logger");

const DEFAULT_HTTP_TIMEOUT_MS = 6000;
const DEFAULT_USER_AGENT = "SismosCercanosAlexa/1.0 (+https://developer.amazon.com)";

try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch (ignore) {}

/**
 * @function resolveTimeoutMs
 * @description Nunca deja el timeout en undefined: en JavaScript eso dispara el reloj al instante y EMSC/USGS “fallan” sin llegar a salir a internet.
 * @params {*} value - Timeout pedido por el caller o por config.
 */
function resolveTimeoutMs(value) {
  const n = parseInt(value, 10);
  if (n > 0) {
    return n;
  }
  return DEFAULT_HTTP_TIMEOUT_MS;
}

/**
 * @function getUserAgent
 * @description Lee el User-Agent tarde, para no crear un require circular con config.js.
 */
function getUserAgent() {
  try {
    const loaded = require("./config");
    const cfg = loaded && loaded.config ? loaded.config : loaded;
    if (cfg && cfg.userAgent) {
      return cfg.userAgent;
    }
  } catch (ignore) {}
  return DEFAULT_USER_AGENT;
}

/**
 * @function makeTimeoutError
 * @description Crea un Error con code ETIMEDOUT.
 * @params {string} message - Texto del timeout.
 */
function makeTimeoutError(message) {
  const error = new Error(message);
  error.code = "ETIMEDOUT";
  error.name = "TimeoutError";
  return error;
}

/**
 * @function withTimeout
 * @description Compite una promesa contra un reloj. Si timeoutMs es undefined, usa 6000 ms (nunca 0).
 * @params {Promise} promise - Petición HTTP en curso.
 * @params {number} timeoutMs - Tope en milisegundos.
 * @params {string} message - Mensaje si vence el reloj.
 */
function withTimeout(promise, timeoutMs, message) {
  const delay = resolveTimeoutMs(timeoutMs);
  return new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(makeTimeoutError(message || "Timeout after " + delay + "ms"));
    }, delay);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (error) {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * @function withQuery
 * @description Añade parámetros de query a una URL sin usar URL.searchParams (no existe como global en runtimes viejos de Alexa-hosted).
 * @params {string} baseUrl - URL base, con o sin query.
 * @params {object} params - Pares clave/valor.
 */
function withQuery(baseUrl, params) {
  const pairs = [];
  const keys = Object.keys(params || {});
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (params[key] === undefined || params[key] === null) {
      continue;
    }
    pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])));
  }
  if (!pairs.length) {
    return baseUrl;
  }
  const sep = baseUrl.indexOf("?") >= 0 ? "&" : "?";
  return baseUrl + sep + pairs.join("&");
}

/**
 * @function allSettled
 * @description Promise.allSettled o un polyfill. Alexa-hosted a veces corre Node anterior a 12.6.
 * @params {Array} promises - Promesas de EMSC y USGS.
 */
function allSettled(promises) {
  if (Promise.allSettled) {
    return Promise.allSettled(promises);
  }
  return Promise.all(
    promises.map(function (promise) {
      return Promise.resolve(promise).then(
        function (value) {
          return { status: "fulfilled", value: value };
        },
        function (reason) {
          return { status: "rejected", reason: reason };
        }
      );
    })
  );
}

/**
 * @function fetchResponse
 * @description GET con http/https nativo. Devuelve ok, status, text() y json().
 * @params {string} url - URL absoluta.
 * @params {object} options - method, headers, timeoutMs y redirectCount.
 */
function fetchResponse(url, options) {
  const settings = options || {};
  const method = settings.method || "GET";
  const headers = settings.headers || {};
  const timeoutMs = resolveTimeoutMs(settings.timeoutMs);
  const redirectCount = settings.redirectCount || 0;

  return new Promise(function (resolve, reject) {
    const parsed = urlLib.parse(url);
    const lib = parsed.protocol === "http:" ? http : https;
    let port = 80;
    if (parsed.port) {
      port = Number(parsed.port);
    } else if (parsed.protocol === "https:") {
      port = 443;
    }
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: port,
        path: parsed.path,
        method: method,
        headers: headers,
        family: 4,
      },
      function (res) {
        const locationHeader = res.headers && res.headers.location;
        if (
          locationHeader &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          redirectCount < 3
        ) {
          res.resume();
          resolve(
            fetchResponse(
              urlLib.resolve(url, locationHeader),
              Object.assign({}, settings, { redirectCount: redirectCount + 1 })
            )
          );
          return;
        }

        const chunks = [];
        res.on("data", function (chunk) {
          chunks.push(chunk);
        });
        res.on("end", function () {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: function () {
              return Promise.resolve(text);
            },
            json: function () {
              return Promise.resolve(JSON.parse(text));
            },
          });
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, function () {
      req.destroy();
      reject(makeTimeoutError("Timeout after " + timeoutMs + "ms for " + url));
    });
    req.end();
  });
}

/**
 * @function fetchJson
 * @description GET JSON con timeout y HTTP 204 como FeatureCollection vacío.
 * @params {string} url - URL completa.
 * @params {object} options - timeoutMs y headers extra.
 */
async function fetchJson(url, options) {
  const settings = options || {};
  const timeoutMs = resolveTimeoutMs(settings.timeoutMs);
  const headers = settings.headers || {};
  const started = Date.now();
  const requestHeaders = Object.assign(
    {
      Accept: "application/json",
      "User-Agent": getUserAgent(),
    },
    headers
  );

  try {
    const response = await withTimeout(
      fetchResponse(url, {
        method: "GET",
        headers: requestHeaders,
        timeoutMs: timeoutMs,
      }),
      timeoutMs,
      "Timeout after " + timeoutMs + "ms for " + url
    );

    const elapsedMs = Date.now() - started;
    if (!response.ok) {
      const error = new Error("HTTP " + response.status + " for " + url);
      error.status = response.status;
      error.elapsedMs = elapsedMs;
      throw error;
    }

    if (response.status === 204) {
      return { body: { type: "FeatureCollection", features: [] }, status: 204, elapsedMs: elapsedMs };
    }

    const text = await response.text();
    if (!text.trim()) {
      return {
        body: { type: "FeatureCollection", features: [] },
        status: response.status,
        elapsedMs: elapsedMs,
      };
    }

    const body = JSON.parse(text);
    return { body: body, status: response.status, elapsedMs: elapsedMs };
  } catch (error) {
    if (error.code === "ETIMEDOUT") {
      error.elapsedMs = Date.now() - started;
      logger.warn("http_timeout", { url: url, timeoutMs: timeoutMs });
      throw error;
    }
    logger.warn("http_error", {
      url: url,
      status: error.status || null,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { fetchJson, fetchResponse, withTimeout, withQuery, allSettled };
