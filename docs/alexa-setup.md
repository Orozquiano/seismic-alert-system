# Configurar la skill en Alexa

Esto usa solo mecanismos oficiales: Custom Skill + Device Address API.

## 1. Empaquetar el código

En la raíz del proyecto:

Crea un ZIP con `index.js` y `src/` (Windows PowerShell):

```powershell
Compress-Archive -Path index.js,src,package.json -DestinationPath sismos-cercanos-lambda.zip
```

O en bash:

```bash
zip -r sismos-cercanos-lambda.zip index.js src package.json
```

## 2. Lambda

1. Región **N. Virginia (us-east-1)** para skills de Norte América / `es-US`.
2. Runtime Node.js 20.
3. Handler: `index.handler`.
4. Timeout: 10 segundos. Memoria: 256 MB.
5. Sube el ZIP.
6. Variables de entorno: copia las de `.env.example` (sin `DEFAULT_LAT` en producción).
7. Crea un trigger de Alexa Skills Kit y anota el ARN.

## 3. Skill en developer.amazon.com

1. Create skill → Custom → Provision your own → Node (el código ya está en Lambda).
2. Modelo de idioma: **Spanish (US)**.
3. Invocation name: `sismos cercanos`.
4. Importa `skill-package/interactionModels/custom/es-US.json`.
5. Endpoint: el ARN de Lambda.
6. Permissions: **Device Address** (Full Address).
7. En el Echo o la app: habilita la skill, acepta el permiso de dirección y escribe una dirección real.

## 4. Prueba

Consola de Alexa → Test:

- “abre sismos cercanos”
- “si hay temblores cerca”

Si no concediste el permiso, Alexa debe pedir la tarjeta de consentimiento.

## 5. Colombia

Amazon documenta dispositivos internacionales en Colombia con idioma **Spanish (U.S.)** y tienda de `amazon.com`. Publica la skill en ese locale. `distributionCountries` en el manifiesto incluye `CO` y `US`; ajústalo si la consola no acepta `CO`.
