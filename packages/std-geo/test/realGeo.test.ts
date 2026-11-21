// Seed 1337
import { afterEach, expect, test, vi } from "vitest";
import { mulberry32 } from "../src/internal/mulberry32.ts";
import { realGeo } from "../src/internal/realGeo.ts";
import { simGeo } from "../src/internal/simGeo.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

type Success = (p: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type Failure = (e: { message: string }) => void;

function fakeNavigator(getCurrentPosition: (ok: Success, fail: Failure) => void): void {
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
}

test("a reading of the platform is ok with lat, lon and accuracy", async () => {
  const calls: number[] = [];
  fakeNavigator((success) => {
    calls.push(1);
    success({ coords: { latitude: 12.5, longitude: -45.25, accuracy: 7 } });
  });
  const r = await realGeo().position();
  expect(r).toEqual({ ok: true, value: { lat: 12.5, lon: -45.25, accuracy: 7 } });
  expect(calls).toHaveLength(1);
});

test("a reading outside Position is geo.unavailable", async () => {
  fakeNavigator((success) => success({ coords: { latitude: 91, longitude: 0, accuracy: 1 } }));
  const r = await realGeo().position();
  expect(r).toEqual({ ok: false, error: { code: "geo.unavailable", message: "reading fails Position", data: {} } });
});

test("a denied request is geo.unavailable and names the platform's message", async () => {
  fakeNavigator((_success, fail) => fail({ message: "User denied" }));
  const r = await realGeo().position();
  expect(r).toEqual({
    ok: false,
    error: { code: "geo.unavailable", message: "geolocation failed: User denied", data: {} },
  });
});

test("a platform that throws is geo.unavailable, never a throw", async () => {
  fakeNavigator(() => {
    throw new Error("boom");
  });
  const r = await realGeo().position();
  expect(r).toEqual({ ok: false, error: { code: "geo.unavailable", message: "geolocation threw: boom", data: {} } });
  fakeNavigator(() => {
    throw "plain";
  });
  const t = await realGeo().position();
  expect(t).toEqual({ ok: false, error: { code: "geo.unavailable", message: "geolocation threw: plain", data: {} } });
});

test("a navigator without geolocation is geo.unavailable", async () => {
  vi.stubGlobal("navigator", {});
  const r = await realGeo().position();
  expect(r).toEqual({
    ok: false,
    error: { code: "geo.unavailable", message: "navigator.geolocation is absent", data: {} },
  });
});

test("no navigator at all is geo.unavailable", async () => {
  vi.stubGlobal("navigator", undefined);
  const r = await realGeo().position();
  expect(r.ok).toBe(false);
  expect(r.ok ? "" : r.error.message).toBe("navigator.geolocation is absent");
});

test("a failure message is cut to one line of at most 89 characters", async () => {
  fakeNavigator((_success, fail) => fail({ message: "x".repeat(200) }));
  const r = await realGeo().position();
  expect(r.ok ? "" : r.error.message).toBe(`geolocation failed: ${"x".repeat(69)}`);
  expect(r.ok ? 0 : r.error.message.length).toBe(89);
});

test("mulberry32 gives the published sequence for a seed", () => {
  const next = mulberry32(1);
  expect([next(), next(), next()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
});

test("the sim position for a seed is fixed", async () => {
  const next = mulberry32(1337);
  const a = next();
  const b = next();
  const c = next();
  const r = await simGeo(1337).position();
  expect(r).toEqual({ ok: true, value: { lat: -90 + 180 * a, lon: -180 + 360 * b, accuracy: 1 + 99 * c } });
});
