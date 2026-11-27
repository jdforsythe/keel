import type { Vec3 } from "./Vec3.ts";
import { mulMatrix } from "./mulMatrix.ts";

const TO_LMS: readonly [Vec3, Vec3, Vec3] = [
  [0.8189330101, 0.3618667424, -0.1288597137],
  [0.0329845436, 0.9293118715, 0.0361456387],
  [0.0482003018, 0.2643662691, 0.633851707],
];
const TO_LAB: readonly [Vec3, Vec3, Vec3] = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

/** CIE XYZ under D65 to Oklch: lightness, chroma, and the hue in degrees from 0 up to 360 (0 when achromatic). */
export function xyzToOklch(xyz: Vec3): Vec3 {
  const [l, m, s] = mulMatrix(TO_LMS, xyz);
  const [lightness, a, b] = mulMatrix(TO_LAB, [Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)]);
  const chroma = Math.hypot(a, b);
  const hue = chroma < 0.0001 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;
  return [lightness, chroma, hue < 0 ? hue + 360 : hue];
}
