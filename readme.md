# 🌎 Earthquake Early Warning

Plataforma de **alerta sísmica temprana** diseñada para detectar eventos sísmicos en tiempo casi real, analizar su posible impacto geográfico y emitir alertas oportunas mediante Alexa y otros dispositivos conectados.

> **Importante:** este proyecto no pretende predecir terremotos. Su objetivo es detectar un evento sísmico una vez iniciado y aprovechar el tiempo disponible antes de la llegada del movimiento fuerte a determinadas zonas.

---

## 🎯 Objetivo

Desarrollar una plataforma capaz de:

* Detectar eventos sísmicos en tiempo casi real.
* Integrar múltiples fuentes sísmicas.
* Normalizar y correlacionar eventos provenientes de diferentes proveedores.
* Evitar eventos duplicados.
* Analizar magnitud, profundidad, ubicación y tiempo del evento.
* Determinar si una ubicación puede verse afectada.
* Generar alertas según el nivel de riesgo.
* Utilizar Alexa como canal de alerta sonora.
* Permitir posteriormente la integración con aplicaciones móviles, IoT y otros sistemas.
* Escalar progresivamente a diferentes países.

---

## 🏗️ Arquitectura

La arquitectura está diseñada para desacoplar las fuentes sísmicas del sistema de alertas.

```text
                   🌎 FUENTES SÍSMICAS
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
            SGC          EMSC         USGS
             │            │            │
             └────────────┼────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Event Ingestion │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Event Manager  │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Deduplication   │
                 │ & Correlation   │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Risk Calculator │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Alert Manager   │
                 └────────┬────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           🔊 Alexa     📱 App       IoT
```

---

## 🌐 Fuentes sísmicas

El sistema está diseñado para trabajar con múltiples fuentes.

### Servicio Geológico Colombiano

Fuente prioritaria para eventos sísmicos relacionados con Colombia.

Se investigarán y utilizarán los servicios públicos disponibles, evaluando especialmente:

* Latencia.
* Disponibilidad.
* Formato de datos.
* Frecuencia de actualización.
* Cobertura.
* Restricciones de uso.
* Posibilidad de integración en tiempo casi real.

### EMSC

European-Mediterranean Seismological Centre.

Se evaluarán sus servicios de eventos sísmicos y mecanismos de distribución near-real-time.

### USGS

United States Geological Survey.

Se utilizará como fuente internacional y potencial fuente secundaria de información sísmica.

> Las fuentes no deben considerarse equivalentes. Cada una puede tener diferentes tiempos de detección, procesamiento, actualización y cobertura.

---

## 🔄 Normalización de eventos

Cada proveedor puede utilizar estructuras y nombres de campos diferentes.

El sistema utilizará un modelo común:

```text
EarthquakeEvent
├── id
├── source
├── sourceEventId
├── magnitude
├── latitude
├── longitude
├── depthKm
├── originTime
├── detectionTime
├── updateTime
├── locationDescription
├── eventType
├── status
├── confidence
└── rawData
```

Cada fuente tendrá un adaptador independiente:

```text
SGCAdapter
EMSCAdapter
USGSAdapter
```

Esto permite agregar nuevas fuentes sin modificar el núcleo de la plataforma.

---

## 🔁 Deduplicación

Un mismo terremoto puede ser reportado por diferentes fuentes.

Por ejemplo:

```text
SGC  → Evento A
EMSC → Evento B
USGS → Evento C
```

El sistema debe determinar si representan el mismo evento mediante parámetros como:

* Tiempo.
* Latitud.
* Longitud.
* Magnitud.
* Profundidad.
* Identificador de evento cuando esté disponible.

El objetivo es evitar que un mismo terremoto genere múltiples alertas.

---

## 📍 Evaluación de riesgo

El sistema no debe generar una alerta únicamente porque exista un terremoto.

Debe analizar la relación entre:

```text
Epicentro
    +
Magnitud
    +
Profundidad
    +
Ubicación del usuario
    +
Otros parámetros sísmicos
    ↓
Posible impacto
```

Los niveles de alerta serán configurables y deberán basarse en criterios técnicos y científicos validados.

No se deben inventar umbrales científicos para producción.

---

## 🚨 Sistema de alertas

El sistema podrá manejar diferentes niveles de información y alerta.

Ejemplo:

### Información

> Se registró un sismo de magnitud 4.2 aproximadamente a 80 kilómetros de esta ubicación.

### Alerta

> Alerta sísmica. Se ha detectado un terremoto que puede afectar esta zona. Agáchate, cúbrete y sujétate.

Los mensajes deben evitar cualquier afirmación que implique predicción.

No utilizar mensajes como:

> "Va a ocurrir un terremoto."

Preferir:

> "Se ha detectado un terremoto."

---

## 🔊 Alexa

Alexa será inicialmente uno de los principales canales de salida.

Se investigarán las capacidades oficiales disponibles para:

* Alexa Skills.
* Alexa Notifications.
* Alexa Smart Home.
* Alexa Routines.
* Reproducción de alertas automáticas.
* Integración con dispositivos compatibles.

### Consideración importante

Un Skill estándar de Alexa no debe asumir que puede iniciar audio arbitrariamente en cualquier momento.

La arquitectura debe validar primero qué mecanismos oficiales permiten entregar una alerta iniciada desde el backend.

---

## ⏱️ Latencia

La latencia es uno de los factores críticos del proyecto.

Se pretende medir:

```text
T0 → Inicio del evento
T1 → Primera detección
T2 → Publicación por la fuente
T3 → Recepción por nuestro backend
T4 → Procesamiento
T5 → Decisión de alerta
T6 → Entrega al dispositivo
T7 → Reproducción de la alerta
```

El objetivo es minimizar:

```text
T7 - T1
```

y determinar cuánto tiempo puede existir entre la detección y la llegada del movimiento fuerte a una determinada ubicación.

No se debe prometer un número fijo de segundos.

---

## 🛡️ Seguridad y confiabilidad

Debido a que el sistema está relacionado con seguridad física, debe priorizar:

* Redundancia.
* Disponibilidad.
* Baja latencia.
* Tolerancia a fallos.
* Observabilidad.
* Trazabilidad.
* Seguridad.
* Privacidad.
* Validación de eventos.
* Manejo de fuentes desconectadas.
* Manejo de eventos corregidos.
* Manejo de eventos duplicados.
* Control de falsos positivos.

El sistema nunca debe depender de una única fuente cuando existan alternativas técnicamente viables.

---

## 📊 Observabilidad

Cada evento debe permitir conocer:

```text
Fuente
ID del evento
Fecha de detección
Fecha de recepción
Fecha de procesamiento
Fecha de decisión
Fecha de envío de alerta
Resultado de entrega
```

Esto permitirá medir la latencia real del sistema y detectar problemas en cualquiera de sus componentes.

---

## 🔐 Privacidad

La ubicación del usuario debe tratarse como información sensible.

Se debe almacenar únicamente la información necesaria para prestar el servicio.

Cuando sea posible:

* Minimizar datos almacenados.
* Utilizar coordenadas aproximadas cuando no se requiera precisión.
* Proteger la información almacenada.
* Utilizar conexiones HTTPS.
* No almacenar credenciales en el código.
* Utilizar variables de entorno y gestores de secretos.

---

## 🚀 Roadmap

### Fase 1 — Investigación

* [ ] Investigar SGC.
* [ ] Investigar EMSC.
* [ ] Investigar USGS.
* [ ] Investigar Android Earthquake Alerts.
* [ ] Investigar capacidades oficiales de Alexa.
* [ ] Determinar fuentes realmente near-real-time.
* [ ] Medir latencia.

### Fase 2 — Arquitectura

* [ ] Definir arquitectura backend.
* [ ] Definir modelo `EarthquakeEvent`.
* [ ] Definir adapters.
* [ ] Diseñar deduplicación.
* [ ] Diseñar correlación de eventos.
* [ ] Diseñar Risk Calculator.
* [ ] Diseñar Alert Manager.
* [ ] Definir almacenamiento.
* [ ] Definir observabilidad.

### Fase 3 — MVP

* [ ] Integración SGC.
* [ ] Integración EMSC.
* [ ] Integración USGS.
* [ ] Normalización.
* [ ] Deduplicación.
* [ ] Registro de eventos.
* [ ] Evaluación geográfica.
* [ ] Generación de alertas.
* [ ] Integración con Alexa.

### Fase 4 — Validación

* [ ] Pruebas de latencia.
* [ ] Pruebas de disponibilidad.
* [ ] Pruebas de fuentes desconectadas.
* [ ] Pruebas de eventos duplicados.
* [ ] Pruebas de eventos corregidos.
* [ ] Pruebas de carga.
* [ ] Pruebas de falsas alertas.
* [ ] Pruebas de recuperación ante fallos.

### Fase 5 — Expansión

* [ ] Aplicación móvil.
* [ ] Notificaciones push.
* [ ] Integración IoT.
* [ ] Smart Home.
* [ ] Nuevas fuentes sísmicas.
* [ ] Soporte para otros países.
* [ ] Panel de monitoreo.

---

## ⚠️ Limitaciones

Este proyecto no predice terremotos.

La disponibilidad de una alerta y el tiempo de anticipación dependen de factores como:

* Distancia al epicentro.
* Magnitud.
* Profundidad.
* Distribución de estaciones sísmicas.
* Tiempo de detección.
* Tiempo de procesamiento.
* Latencia de red.
* Disponibilidad de los servicios externos.
* Capacidad del dispositivo receptor.

Por lo tanto, una alerta puede llegar con diferentes niveles de anticipación o incluso después de que el movimiento haya comenzado en determinadas ubicaciones.

---

## 📁 Estructura propuesta

```text
earthquake-early-warning/
│
├── backend/
│
├── earthquake-sources/
│   ├── sgc/
│   ├── emsc/
│   └── usgs/
│
├── event-manager/
│
├── risk-calculator/
│
├── alert-manager/
│
├── alexa-skill/
│
├── infrastructure/
│
├── tests/
│
├── docs/
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 🤝 Principios del proyecto

1. **Detectar, no predecir.**
2. **Priorizar la baja latencia.**
3. **Utilizar fuentes confiables.**
4. **No depender de una única fuente.**
5. **No inventar información sísmica.**
6. **No asumir capacidades de terceros.**
7. **Medir la latencia real.**
8. **Diseñar para fallos.**
9. **Proteger la privacidad.**
10. **Construir una arquitectura escalable internacionalmente.**

---

## 📌 Estado del proyecto

**Estado:** 🚧 Investigación / Diseño

El proyecto se encuentra actualmente en fase de investigación de fuentes sísmicas, latencia, arquitectura y mecanismos oficiales de integración con Alexa.

La implementación comenzará una vez validadas las fuentes de datos y las capacidades técnicas necesarias para generar alertas de forma confiable.
