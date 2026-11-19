/** A point on the globe, in degrees. */
type Point = { readonly lat: number; readonly lon: number };

/** The mean radius of the Earth in kilometers. */
const EARTH_KM = 6371;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;

/** The great-circle distance between two points in kilometers (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
