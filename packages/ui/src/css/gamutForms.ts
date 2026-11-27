import type { GamutForm } from "../types/GamutForm.ts";

/** Both forms an overlay is composited in before its contrast is judged, the lower ratio standing (k.values Contrast). */
export const gamutForms: readonly GamutForm[] = ["mapped", "clipped"];
