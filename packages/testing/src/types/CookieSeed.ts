/** A cookie `open` puts in a new context before the load (k.e2e Served `open`): the one way a test gives a value. */
export type CookieSeed = {
  readonly name: string;
  readonly value: string;
  /** The origin the cookie is for (`https://api.example.com`). */
  readonly origin: string;
  readonly sameSite?: "Strict" | "Lax" | "None";
  readonly secure?: boolean;
  readonly httpOnly?: boolean;
};
