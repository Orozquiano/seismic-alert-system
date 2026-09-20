const { test } = require("node:test");
const assert = require("node:assert/strict");
const { haversineKm, hypocentralDistanceKm, kmToDegrees } = require("../src/geo/distance");
const { sameEvent, dedupeEvents } = require("../src/quakes/dedupe");
const { nearbySpeech } = require("../src/speech/es");
const { mapUsgsFeature } = require("../src/adapters/usgsAdapter");
const { mapEmscFeature } = require("../src/adapters/emscAdapter");

test("haversine distance Bogotá to Medellín is about 240 km", () => {
  const km = haversineKm(
    { latitude: 4.711, longitude: -74.072 },
    { latitude: 6.244, longitude: -75.581 }
  );
  assert.ok(km > 230 && km < 260, km);
});

test("hypocentral distance includes depth", () => {
  const epicenter = { latitude: 4.7, longitude: -74.1 };
  const event = { latitude: 4.7, longitude: -74.1, depthKm: 100 };
  assert.equal(Math.round(hypocentralDistanceKm(epicenter, event)), 100);
});

test("km to degrees conversion", () => {
  assert.ok(Math.abs(kmToDegrees(111.32) - 1) < 0.001);
});

function quake(overrides) {
  return {
    source: "EMSC",
    sourceEventId: "a",
    magnitude: 4.2,
    latitude: 4.6,
    longitude: -74.1,
    depthKm: 40,
    originTime: new Date("2026-09-19T14:00:00Z"),
    updateTime: new Date("2026-09-19T14:02:00Z"),
    locationDescription: "COLOMBIA",
    status: "automatic",
    ...overrides,
  };
}

test("dedupes the same earthquake from EMSC and USGS", () => {
  const emsc = quake({ source: "EMSC", sourceEventId: "1" });
  const usgs = quake({
    source: "USGS",
    sourceEventId: "us1",
    magnitude: 4.4,
    latitude: 4.61,
    longitude: -74.12,
    originTime: new Date("2026-09-19T14:00:40Z"),
    status: "reviewed",
    locationDescription: "10 km S of Bogotá, Colombia",
  });
  assert.equal(sameEvent(emsc, usgs), true);
  const unique = dedupeEvents([emsc, usgs]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].source, "USGS");
});

test("does not merge distant events", () => {
  const a = quake();
  const b = quake({
    sourceEventId: "b",
    latitude: 10.4,
    longitude: -75.5,
  });
  assert.equal(sameEvent(a, b), false);
  assert.equal(dedupeEvents([a, b]).length, 2);
});

test("speech never predicts a future earthquake", () => {
  const text = nearbySpeech({
    events: [
      {
        magnitude: 4.2,
        distanceKm: 80,
        depthKm: 40,
        originTime: new Date("2026-09-19T14:00:00Z"),
        locationDescription: "COLOMBIA",
      },
    ],
    query: { minMagnitude: 3, radiusKm: 250, lookbackHours: 48 },
    timeZone: "America/Bogota",
  });
  assert.match(text, /Se registró/);
  assert.match(text, /en Colombia/);
  assert.doesNotMatch(text, /va a ocurrir/i);
  assert.match(text, /No predice terremotos/);
});

test("empty result speech is informational", () => {
  const text = nearbySpeech({
    events: [],
    query: { minMagnitude: 3, radiusKm: 250, lookbackHours: 48 },
  });
  assert.match(text, /No se registraron sismos/);
});

test("USGS adapter maps GeoJSON feature", () => {
  const event = mapUsgsFeature({
    id: "us7000test",
    properties: {
      mag: 4.9,
      magType: "mww",
      place: "117 km NW of Barranca, Peru",
      time: 1789801947058,
      updated: 1789802952040,
      status: "reviewed",
      type: "earthquake",
    },
    geometry: { type: "Point", coordinates: [-77.349, -4.0134, 10] },
  });
  assert.equal(event.source, "USGS");
  assert.equal(event.latitude, -4.0134);
  assert.equal(event.longitude, -77.349);
  assert.equal(event.depthKm, 10);
  assert.equal(event.magnitude, 4.9);
});

test("EMSC adapter maps GeoJSON with standard lon,lat,depth", () => {
  const event = mapEmscFeature({
    id: "20260919_0000161",
    properties: {
      unid: "20260919_0000161",
      mag: 5,
      magtype: "mb",
      time: "2026-09-19T13:44:36.8Z",
      lastupdate: "2026-09-19T15:11:22Z",
      flynn_region: "COLOMBIA",
      lat: 4.61,
      lon: -76.63,
      depth: 60,
    },
    geometry: { type: "Point", coordinates: [-76.63, 4.61, -60] },
  });
  assert.equal(event.latitude, 4.61);
  assert.equal(event.longitude, -76.63);
  assert.equal(event.depthKm, 60);
});

function mockHttps(handler) {
  const https = require("https");
  const originalRequest = https.request;
  https.request = function (opts, callback) {
    const url = "https://" + opts.hostname + opts.path;
    const req = {
      on: function (event, fn) {
        if (event === "error") {
          req._onError = fn;
        }
        return req;
      },
      setTimeout: function () {
        return req;
      },
      destroy: function () {},
      end: function () {
        let result;
        try {
          result = handler(url);
        } catch (error) {
          if (req._onError) {
            req._onError(error);
          }
          return;
        }
        const statusCode = result.status;
        const body = result.text || "";
        const res = {
          statusCode: statusCode,
          on: function (event, fn) {
            if (event === "data" && body) {
              fn(Buffer.from(body));
            }
            if (event === "end") {
              fn();
            }
          },
        };
        callback(res);
      },
    };
    return req;
  };
  return function restore() {
    https.request = originalRequest;
  };
}

test("fetchJson treats HTTP 204 as an empty feature collection", async () => {
  const restore = mockHttps(() => ({ status: 204, text: "" }));
  try {
    const { fetchJson } = require("../src/http");
    const result = await fetchJson("https://example.test/events");
    assert.deepEqual(result.body.features, []);
    assert.equal(result.status, 204);
  } finally {
    restore();
  }
});

test("city fallback maps Bogotá even with accents or extra text", () => {
  const { cityFallback } = require("../src/location/geocode");
  const hit = cityFallback({ city: "Bogotá D.C.", countryCode: "CO" });
  assert.equal(hit.source, "city-fallback");
  assert.ok(Math.abs(hit.latitude - 4.711) < 0.01);
  assert.ok(Math.abs(hit.longitude + 74.072) < 0.01);
});

test("geocodeAddress uses Open-Meteo when it returns a hit", async () => {
  const restore = mockHttps((url) => {
    assert.match(String(url), /open-meteo/);
    return {
      status: 200,
      text: JSON.stringify({
        results: [
          {
            latitude: 4.6097,
            longitude: -74.0817,
            name: "Bogotá",
            admin1: "Bogotá",
            country: "Colombia",
          },
        ],
      }),
    };
  });
  try {
    const { geocodeAddress } = require("../src/location/geocode");
    const location = await geocodeAddress({ city: "Bogotá", countryCode: "CO" });
    assert.equal(location.source, "open-meteo");
    assert.equal(location.latitude, 4.6097);
    assert.equal(location.longitude, -74.0817);
  } finally {
    restore();
  }
});

test("geocodeAddress falls back to a Colombia city center when both geocoders fail", async () => {
  const restore = mockHttps(() => {
    throw new Error("geocoder blocked");
  });
  try {
    const { geocodeAddress } = require("../src/location/geocode");
    const location = await geocodeAddress({ city: "Medellín", countryCode: "CO" });
    assert.equal(location.source, "city-fallback");
    assert.ok(Math.abs(location.latitude - 6.244) < 0.01);
  } finally {
    restore();
  }
});
