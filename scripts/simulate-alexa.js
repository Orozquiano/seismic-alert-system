#!/usr/bin/env node
/**
 * @class SimulateAlexaScript
 * @description Simula un LaunchRequest de Alexa en local. Activa ALLOW_DEFAULT_LOCATION para usar coordenadas de .env y no llamar Device Address (no hay token real de Amazon).
 */
process.env.ALLOW_DEFAULT_LOCATION = "true";

const { handler } = require("../src/lambda");

const event = {
  version: "1.0",
  session: {
    new: true,
    sessionId: "amzn1.echo-api.session.test",
    application: { applicationId: "amzn1.ask.skill.test" },
    user: { userId: "amzn1.ask.account.test" },
  },
  context: {
    System: {
      application: { applicationId: "amzn1.ask.skill.test" },
      user: { userId: "amzn1.ask.account.test" },
      device: { deviceId: "amzn1.ask.device.test", supportedInterfaces: {} },
      apiEndpoint: "https://api.amazonalexa.com",
      apiAccessToken: "test",
    },
  },
  request: {
    type: "LaunchRequest",
    requestId: "amzn1.echo-api.request.test",
    timestamp: new Date().toISOString(),
    locale: "es-US",
  },
};

handler(event, {}).then((response) => {
  console.log(JSON.stringify(response, null, 2));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
