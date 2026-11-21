import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { digest } from "./digest.contract.ts";
import { readLatest } from "./readLatest.ts";

/** `GET /digest`: the newest digest. */
export const loadDigest = loader(digest, "digest.show", {}, async (_args, ctx) => ok(await readLatest(ctx)));
