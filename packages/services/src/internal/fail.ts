import type { SchemaError } from "@keel/schema";
import type { ApiError } from "../ApiError.ts";

type Issues = SchemaError["data"]["issues"];

/** Constructors for the five ApiError variants (k.services). */
export const fail = {
  timeout: (ms: number): ApiError<never> => ({
    code: "api.timeout",
    message: `no response within ${ms} ms`,
    data: { ms },
  }),
  network: (): ApiError<never> => ({ code: "api.network", message: "fetch rejected", data: {} }),
  status: <B>(status: number, body: B | null): ApiError<B> => ({
    code: "api.status",
    message: `status ${status}`,
    data: { status, body },
  }),
  decode: (issues: Issues): ApiError<never> => ({
    code: "api.decode",
    message: "value does not match its schema",
    data: { issues },
  }),
  input: (issues: Issues): ApiError<never> => ({
    code: "api.input",
    message: "call input does not match its schema",
    data: { issues },
  }),
};
