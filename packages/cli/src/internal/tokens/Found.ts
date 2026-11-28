import type { DesignToken } from "./DesignToken.ts";

/** A token and the index of the file that holds it. */
export type Found = { readonly file: number; readonly token: DesignToken };
