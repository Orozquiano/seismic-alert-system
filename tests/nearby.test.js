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

test("fetchJson treats HTTP 204 as an empty feature collection", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 204,
    text: async () => "",
  });
  try {
    const { fetchJson } = require("../src/http");
    const result = await fetchJson("https://example.test/events");
    assert.deepEqual(result.body.features, []);
    assert.equal(result.status, 204);
  } finally {
    global.fetch = originalFetch;
  }
});
