import { createHash, timingSafeEqual } from "node:crypto";
import { ok, s } from "@keel/schema";
import { Digested } from "../../Digested.ts";
import { Hashed } from "../../Hashed.ts";
import type { Hasher } from "../Hasher.ts";
import { EXPIRED } from "./EXPIRED.ts";
import type { Engine } from "./Engine.ts";
import { LENGTH } from "./LENGTH.ts";
import { MISMATCH } from "./MISMATCH.ts";
import { TTL } from "./TTL.ts";
import { busy } from "./busy.ts";
import { inputOf } from "./inputOf.ts";
import { malformed } from "./malformed.ts";
import { readDigested } from "./readDigested.ts";
import { readHashed } from "./readHashed.ts";
import { textOf } from "./textOf.ts";

const SALT = 16;
const KEY = 32;
const TTL_MIN = 60000;
const TTL_MAX = 31536000000;
const TOKEN = /^(keel|keelsim)_([0-9a-f]{16})_[0-9a-f]{64}$/;
const SecretText = s.secret(s.string());

const b64 = (b: Buffer): string => b.toString("base64").replaceAll("=", "");
const sha256 = (text: string): Buffer => createHash("sha256").update(text, "utf8").digest();

/**
 * The four methods for a ctx at cost `ln` over one mode's `engine` and clock `now`, each deciding its errors in the
 * order of the API tables. Input bytes and derived keys are zeroed after use; the clock is read after a token matches.
 */
export function hasherOf(ln: number, engine: Engine, now: () => number): Hasher {
  const id = engine.sim ? "scrypt-sim" : "scrypt";
  const limit = 16 >> (ln - 17);
  return {
    hash: async (secret) => {
      const input = inputOf(secret);
      if (input === null) return LENGTH;
      const salt = engine.bytes(SALT);
      const key = await engine.derive(input, salt, KEY, { id, ln, r: 8, p: 1 });
      input.fill(0);
      if (key === null) return busy(limit);
      const parsed = Hashed.parse(`$${id}$ln=${ln},r=8,p=1$${b64(salt)}$${b64(key)}`);
      key.fill(0);
      return parsed.ok ? ok(parsed.value) : busy(limit);
    },
    verify: async (secret, stored) => {
      const input = inputOf(secret);
      if (stored === undefined) {
        if (input === null) return MISMATCH;
        const key = await engine.derive(input, Buffer.alloc(SALT), KEY, { id, ln, r: 8, p: 1 });
        input.fill(0);
        if (key === null) return busy(limit);
        key.fill(0);
        return MISMATCH;
      }
      const was = readHashed(stored);
      if (was === "format" || was === "parameters") {
        input?.fill(0);
        return malformed(was);
      }
      if (was.id === "scrypt-sim" && !engine.sim) {
        input?.fill(0);
        return malformed("sim");
      }
      if (input === null) return MISMATCH;
      const key = await engine.derive(input, was.salt, was.key.length, was);
      input.fill(0);
      if (key === null) return busy(limit);
      const same = timingSafeEqual(key, was.key);
      key.fill(0);
      if (!(same && was.exact)) return MISMATCH;
      return ok({ rehash: was.ln < ln || was.salt.length < SALT || was.key.length < KEY });
    },
    mint: ({ ttl }) => {
      if (ttl !== null && !(Number.isInteger(ttl) && ttl >= TTL_MIN && ttl <= TTL_MAX)) return TTL;
      const tokenId = engine.bytes(8).toString("hex");
      const secretBytes = engine.bytes(32);
      const text = `${engine.sim ? "keelsim" : "keel"}_${tokenId}_${secretBytes.toString("hex")}`;
      secretBytes.fill(0);
      const expiresAt = ttl === null ? null : now() + ttl;
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
      if (row === undefined) return MISMATCH;
      const want = readDigested(row.digest);
      if (want === "format" || want === "parameters") return malformed(want);
      if (want.sim && !engine.sim) return malformed("sim");
      const same = timingSafeEqual(got, want.digest);
      if (!same || want.sim !== (m[1] === "keelsim")) return MISMATCH;
      if (want.expiresAt !== null && now() >= want.expiresAt) return EXPIRED;
      return ok(row);
    },
  };
}
