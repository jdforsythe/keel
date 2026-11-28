# prove-rlimit: `rlimit` of 2^32 or more (proposal, needs an RFC)

Checked: `prove` with `rlimit` 2^32 - 1 resolves `{ proven, z3 }`. With 2^32 and with 2^53 - 1 it rejects a plain `Error` with no code and the message
`prove <t>: Z3 refused the translation: (error "line 1 column 52: invalid value '4294967296' for unsigned int parameter 'rlimit'")`.
Z3 reads `rlimit` as an unsigned 32-bit integer. The claim is true. Spec today says only "an `rlimit` that is not a positive integer rejects E1710", and 2^32 is a positive integer, so this is (b).

## Spec sentence (k.prove, API)
Today: "An empty or mixed list, a repeated transaction, or an `rlimit` that is not a positive integer rejects E1710 (k.model)."
Change to: "An empty or mixed list, a repeated transaction, or an `rlimit` that is not an integer from 1 to 2^32 - 1 rejects E1710 (k.model)."
Size: file is 5,782 chars today (1,446 tokens); the change adds about 12 chars: about 5,794 chars, 1,449 tokens, under 1,500.

## Conformance headers that quote the sentence
`packages/testing/conformance/prove-result.test.ts` line 2 quotes it exactly; the quote must be updated with the sentence.

## Conformance cases wanted
- `prove([t], { rlimit: 2 ** 32 })` rejects E1710.
- `prove([t], { rlimit: 2 ** 53 - 1 })` rejects E1710.
- `prove([t], { rlimit: 2 ** 32 - 1 })` resolves `{ proven: [t.name], z3: "5.3.3" }` for a transaction the default proves.
- Existing cases (0, -1, 1.5, NaN) still reject E1710.

## Code outline
`packages/testing/src/prove/prove.ts` line 152: add `|| rlimit > 0xffffffff` to the existing check and say "an integer from 1 to 4294967295" in the E1710 message. Unit test `packages/testing/test/proveRlimit.test.ts` (the `test.fails` case) turns into a plain `it`.

## The user's to decide
Nothing new in the API; the only choice is E1710 versus clamping to 2^32 - 1. Clamping would silently change what the caller asked for.

## Recommendation
Reject E1710 (no new code, one existing check). The spec's "a count rather than time" wording stays true.
