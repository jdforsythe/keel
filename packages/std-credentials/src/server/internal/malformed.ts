import { type KeelError, type Result, err } from "@keel/schema";

type Reason = "format" | "parameters" | "sim";
type Malformed = KeelError<"credentials.malformed", { readonly reason: Reason }>;

const make = (reason: Reason): Result<never, Malformed> =>
  Object.freeze(
    err<Malformed>(
      Object.freeze({
        code: "credentials.malformed",
        message: `credentials.malformed: ${reason}`,
        data: Object.freeze({ reason }),
      }),
    ),
  );

const answers = { format: make("format"), parameters: make("parameters"), sim: make("sim") };

/** The one `credentials.malformed` answer for `reason`: a stored string this version cannot read. */
export function malformed(reason: Reason): Result<never, Malformed> {
  return answers[reason];
}
