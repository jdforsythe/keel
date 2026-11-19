import { s } from "@keel/schema";
import { isHashed } from "./internal/isHashed.ts";
import { simText } from "./internal/simText.ts";

/**
 * A stored password hash, registered as `credentials.Hashed`: `$id[$v=n]$params$salt$key`, at most 256 characters. It
 * checks the shape only. Its generator gives sim-form strings, `$scrypt-sim$ln=17,r=8,p=1$<salt>$<key>`, that match no
 * secret.
 */
export const Hashed = s.format("credentials.Hashed", s.string(), {
  check: isHashed,
  gen: {
    from: s.string(),
    map: (v: string) => `$scrypt-sim$ln=17,r=8,p=1$${simText(`s${v}`, 22)}$${simText(`k${v}`, 43)}`,
  },
});
export type Hashed = s.infer<typeof Hashed>;

s.register("credentials.Hashed", Hashed);
