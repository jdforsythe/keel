// `sslmode=require` and `sslmode=prefer` reach `pg` as `verify-full`, which `pg` reads them as, so its security
// warning is never printed.
import { expect, test } from "vitest";
import { verifiedSslmode } from "../src/server/internal/verifiedSslmode.ts";

const base = "postgres://u:p@db.example:5432/app";

test.each(["require", "prefer"])("sslmode=%s is written as verify-full, other parameters kept", (mode) => {
  expect(verifiedSslmode(`${base}?application_name=a&sslmode=${mode}`)).toBe(
    `${base}?application_name=a&sslmode=verify-full`,
  );
});

test.each(["disable", "no-verify", "verify-ca", "verify-full"])("sslmode=%s is left as it is", (mode) => {
  const url = `${base}?sslmode=${mode}`;
  expect(verifiedSslmode(url)).toBe(url);
});

test("no sslmode, uselibpqcompat, or a string that is not a URL is left as it is", () => {
  const compat = `${base}?uselibpqcompat=true&sslmode=require`;
  for (const url of [base, compat, "not a url"]) expect(verifiedSslmode(url)).toBe(url);
});
