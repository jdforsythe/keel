// A second app file for privacy-secret-reach.test.ts: it makes a secret after two awaits, called from another file.
import { type Result, type SchemaError, type Secret, s } from "@keel/schema";

export function made<T>(r: Result<Secret<T>, SchemaError>): Secret<T> {
  if (!r.ok) throw new Error("a raw value did not parse as a secret");
  return r.value;
}

export async function mintLater(text: string): Promise<Secret<string>> {
  await Promise.resolve();
  await Promise.resolve();
  return made(s.secret(s.string()).parse(text));
}
