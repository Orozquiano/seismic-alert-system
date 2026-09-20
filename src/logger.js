/**
 * @class Logger
 * @description Logger JSON de una línea para CloudWatch. Separa info, warn y error. No registra calle ni número de la dirección del Echo; solo ciudad, país y métricas de las fuentes.
 */
/**
 * @function log
 * @description Escribe un log en JSON (una línea) para CloudWatch/Lambda. Los errores van a stderr; el resto a stdout.
 * @params {string} level - Nivel del mensaje (info, warn, error) para filtrar fallos de fuentes o de Alexa.
 * @params {string} message - Nombre corto del evento de log (por ejemplo emsc_query) para trazabilidad.
 * @params {object} fields - Datos extra sin dirección de calle: ciudad, conteos, códigos de error. Se omite información innecesaria por privacidad.
 */
function log(level, message, fields = {}) {
  const entry = Object.assign(
    {
      ts: new Date().toISOString(),
      level,
      message,
    },
    fields
  );
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

const logger = {
  /**
   * @function info
   * @description Log informativo de flujo normal (consultas, geocodificación, respuesta lista).
   * @params {string} message - Identificador del evento.
   * @params {object} fields - Contexto adicional opcional.
   */
  info: (message, fields) => log("info", message, fields),
  /**
   * @function warn
   * @description Log de degradación: timeout, fuente caída, zona horaria por defecto.
   * @params {string} message - Identificador del aviso.
   * @params {object} fields - Contexto adicional opcional.
   */
  warn: (message, fields) => log("warn", message, fields),
  /**
   * @function error
   * @description Log de error de la skill cuando hay que devolver un mensaje genérico al usuario.
   * @params {string} message - Identificador del error.
   * @params {object} fields - Contexto adicional opcional (código, mensaje técnico).
   */
  error: (message, fields) => log("error", message, fields),
};

module.exports = { logger };
