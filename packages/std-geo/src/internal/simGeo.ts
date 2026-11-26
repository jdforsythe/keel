import { ok } from "@keel/schema";
import type { Geolocator } from "../Geolocator.ts";
import { mulberry32 } from "./mulberry32.ts";

/** Sim `geo.position`: one fixed position drawn from the capability seed; reads no clock, network or device. */
export function simGeo(seed: number): Geolocator {
  const next = mulberry32(seed);
  const position = { lat: -90 + 180 * next(), lon: -180 + 360 * next(), accuracy: 1 + 99 * next() };
  return { position: () => Promise.resolve(ok({ ...position })) };
}
