import type { Vec3 } from "./Vec3.ts";
import { mulMatrix } from "./mulMatrix.ts";
import { xyzToOklch } from "./xyzToOklch.ts";

type Matrix = readonly [Vec3, Vec3, Vec3];

const SRGB: Matrix = [
  [0.4123907993, 0.3575843394, 0.1804807884],
  [0.2126390059, 0.7151686788, 0.0721923154],
  [0.0193308187, 0.1191947798, 0.9505321522],
];
const A98: Matrix = [
  [0.5766690429, 0.1855582379, 0.1882286462],
  [0.2973449753, 0.6273635663, 0.0752914585],
  [0.0270313614, 0.0706888525, 0.9913375368],
];
const REC2020: Matrix = [
  [0.6369580483, 0.1446169036, 0.1688809752],
  [0.262700212, 0.6779980715, 0.0593017165],
  [0, 0.028072693, 1.0609850577],
];
const PROPHOTO_D50: Matrix = [
  [0.7977604896, 0.1351917082, 0.0313477462],
  [0.2880711282, 0.7118432178, 0.000085654],
  [0, 0, 0.8251046025],
];
const D50_TO_D65: Matrix = [
  [0.9554734527, -0.0230985368, 0.0632593086],
  [-0.0283697069, 1.009995458, 0.0210413989],
  [0.0123140016, -0.0205076964, 1.3303659366],
];
const REC_ALPHA = 1.09929682680944;
const REC_BETA = 0.018053968510807;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const each = (c: Vec3, f: (v: number) => number): Vec3 => [f(c[0]), f(c[1]), f(c[2])];
const signed = (f: (v: number) => number) => (v: number) => (v < 0 ? -f(-v) : f(v));
const gamma = (g: number) => signed((v) => v ** g);
const rec2020 = signed((v) => (v < REC_BETA * 4.5 ? v / 4.5 : ((v + REC_ALPHA - 1) / REC_ALPHA) ** (1 / 0.45)));
const prophoto = signed((v) => (v <= 16 / 512 ? v / 16 : v ** 1.8));

/** CIE Lab (D50 white) to XYZ under D50. */
function labToXyzD50([l, a, b]: Vec3): Vec3 {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const cube = (f: number): number => (f ** 3 > EPSILON ? f ** 3 : (116 * f - 16) / KAPPA);
  const y = l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA;
  return [(cube(fx) * 0.3457) / 0.3585, y, (cube(fz) * 0.2958) / 0.3585];
}

/** sRGB (0 to 1 per channel) from hue in degrees, saturation and lightness in 0 to 1. */
function hslToRgb(h: number, s: number, l: number): Vec3 {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

const linearSrgb = (c: Vec3): Vec3 =>
  each(
    c,
    signed((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)),
  );

/**
 * `components` of a DTCG color in `space` as Oklch (lightness, chroma, hue in degrees), or undefined for a space the
 * importer does not know. Known: `srgb`, `srgb-linear`, `a98-rgb`, `rec2020`, `prophoto-rgb`, `hsl`, `hwb`, `lab`,
 * `lch`, `xyz-d50`, `xyz-d65` and `xyz` (D65).
 */
export function toOklch(space: string, c: Vec3): Vec3 | undefined {
  switch (space) {
    case "srgb":
      return xyzToOklch(mulMatrix(SRGB, linearSrgb(c)));
    case "srgb-linear":
      return xyzToOklch(mulMatrix(SRGB, c));
    case "a98-rgb":
      return xyzToOklch(mulMatrix(A98, each(c, gamma(2.19921875))));
    case "rec2020":
      return xyzToOklch(mulMatrix(REC2020, each(c, rec2020)));
    case "prophoto-rgb":
      return xyzToOklch(mulMatrix(D50_TO_D65, mulMatrix(PROPHOTO_D50, each(c, prophoto))));
    case "hsl":
      return toOklch("srgb", hslToRgb(c[0], c[1] / 100, c[2] / 100));
    case "hwb": {
      const w = c[1] / 100;
      const b = c[2] / 100;
      if (w + b >= 1) return toOklch("srgb", [w / (w + b), w / (w + b), w / (w + b)]);
      return toOklch(
        "srgb",
        each(hslToRgb(c[0], 1, 0.5), (v) => v * (1 - w - b) + w),
      );
    }
    case "lab":
      return xyzToOklch(mulMatrix(D50_TO_D65, labToXyzD50(c)));
    case "lch": {
      const rad = (c[2] * Math.PI) / 180;
      return toOklch("lab", [c[0], c[1] * Math.cos(rad), c[1] * Math.sin(rad)]);
    }
    case "xyz-d50":
      return xyzToOklch(mulMatrix(D50_TO_D65, c));
    case "xyz":
    case "xyz-d65":
      return xyzToOklch(c);
    default:
      return undefined;
  }
}
