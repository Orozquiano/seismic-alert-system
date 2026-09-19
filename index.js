/**
 * @class LambdaEntrypoint
 * @description Punto de entrada del ZIP de AWS Lambda. Reexporta AlexaSkill.handler como index.handler, que es el valor que hay que poner en la consola de Lambda.
 */
const { handler } = require("./src/lambda");

/**
 * @function handler
 * @description Reexporta el handler de src/lambda.js. AWS Lambda usa index.handler como entrypoint del ZIP.
 * @params {object} event - Envelope de Alexa.
 * @params {object} context - Contexto Lambda (no se usa en el MVP).
 */
exports.handler = handler;
