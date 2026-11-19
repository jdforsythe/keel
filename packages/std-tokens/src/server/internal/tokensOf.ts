import { createHash, timingSafeEqual } from "node:crypto";
import { ok, s } from "@keel/schema";
import { Digested } from "../../Digested.ts";
import type { Tokens } from "../Tokens.type.ts";
import { EXPIRED } from "./EXPIRED.ts";
import type { Engine } from "./Engine.ts";
import { MISMATCH } from "./MISMATCH.ts";
import { TTL } from "./TTL.ts";
import { malformed } from "./malformed.ts";
import { readDigested } from "./readDigested.ts";
import { textOf } from "./textOf.ts";

const TTL_MIN = 60000;
const TTL_MAX = 31536000000;
const TOKEN = /^(keel|keelsim)_([0-9a-f]{16})_[0-9a-f]{64}$/;
const SecretText = s.secret(s.string());

const b64 = (b: Buffer): string => b.toString("base64").replaceAll("=", "");
const sha256 = (text: string): Buffer => createHash("sha256").update(text, "utf8").digest();

/**
 * `mint` and `check` over one mode's `engine` and clock `now`, each deciding its errors in the order of the API. The
 * secret's bytes are zeroed after use; the clock is read after a token matches.
 */
export function tokensOf(engine: Engine, now: () => number): Tokens {
  return {
    mint: (options) => {
      const ttl: unknown = typeof options === "object" && options !== null ? options.ttl : undefined;
      const life =
        ttl === null
          ? null
          : typeof ttl === "number" && Number.isInteger(ttl) && ttl >= TTL_MIN && ttl <= TTL_MAX
            ? ttl
            : undefined;
      if (life === undefined) return TTL;
      const tokenId = engine.bytes(8).toString("hex");
      const secretBytes = engine.bytes(32);
      const text = `${engine.sim ? "keelsim" : "keel"}_${tokenId}_${secretBytes.toString("hex")}`;
      secretBytes.fill(0);
      const expiresAt = life === null ? null : Math.floor(now()) + life;
      const exp = expiresAt === null ? "" : `exp=${expiresAt}$`;
      const token = SecretText.parse(text);
      const digest = Digested.parse(`$${engine.sim ? "sha256-sim" : "sha256"}$${exp}${b64(sha256(text))}`);
      if (!token.ok || !digest.ok) return TTL;
      return ok({ token: token.value, id: tokenId, digest: digest.value, expiresAt });
    },
    check: (token, find) => {
      const text = textOf(token);
      const m = TOKEN.exec(text);
      if (m === null || (m[1] === "keelsim" && !engine.sim)) return MISMATCH;
      const row = find(m[2] ?? "");
      const got = sha256(text);
      if (typeof row !== "object" || row === null) return MISMATCH;
      const want = readDigested(row.digest);
      if (want === "format" || want === "parameters") return malformed(want);
      if (want.sim && !engine.sim) return malformed("sim");
      const same = timingSafeEqual(got, want.digest);
      if (!same || want.sim !== (m[1] === "keelsim")) return MISMATCH;
      // An expiry the clock does not read as later than now (`NaN` included) has passed.
      if (want.expiresAt !== null && !(now() < want.expiresAt)) return EXPIRED;
      return ok(row);
    },
  };
}
