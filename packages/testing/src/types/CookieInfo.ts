/** A cookie of a page's context, its value left out (k.e2e-page `cookies`). */
export type CookieInfo = {
  readonly name: string;
  readonly domain: string;
  readonly path: string;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict" | "Lax" | "None";
  /** Seconds since the epoch; -1 for a session cookie. */
  readonly expires: number;
};
