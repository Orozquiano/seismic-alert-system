/**
 * @class LoadEnv
 * @description Carga el archivo .env en process.env para desarrollo local. En AWS Lambda no hace falta: las variables las define la consola. No pisa valores que ya existan, para respetar el entorno del sistema.
 */
const fs = require("fs");
const path = require("path");

/**
 * @function loadEnvFile
 * @description Carga pares KEY=VALUE desde un archivo .env hacia process.env, sin pisar variables que ya existan. Sirve para desarrollo local; en Lambda las variables las pone AWS.
 * @params {string} filename - Nombre del archivo relativo a la raíz del proyecto (normalmente ".env") porque no queremos hardcodear secretos ni rutas absolutas.
 */
function loadEnvFile(filename) {
  const filePath = path.resolve(__dirname, "..", filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");

module.exports = { loadEnvFile };
