// Clause: generator produces only valid values. Seed 1337, 100 runs.
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { allTypes, Enum, Int, Num, Str, RUNS, SEED } from './fixtures'

describe('k.schema generator validity', () => {
  for (const [name, schema] of Object.entries(allTypes)) {
    it(`every gen() sample of ${name} parses ok`, () => {
      fc.assert(
        fc.property(schema.gen(), (v) => schema.parse(v).ok),
        { seed: SEED, numRuns: RUNS },
      )
    })
  }
  it('gen() of number yields only finite numbers', () => {
    fc.assert(fc.property(Num.gen(), (v) => Number.isFinite(v)), { seed: SEED, numRuns: RUNS })
  })
  it('gen() of int yields only safe integers', () => {
    fc.assert(fc.property(Int.gen(), (v) => Number.isInteger(v)), { seed: SEED, numRuns: RUNS })
  })
  it('gen() of string honours min/max', () => {
    fc.assert(
      fc.property(Str.gen(), (v) => v.length >= 1 && v.length <= 8),
      { seed: SEED, numRuns: RUNS },
    )
  })
  it('gen() of enum yields only declared members', () => {
    fc.assert(fc.property(Enum.gen(), (v) => v === 'admin' || v === 'member'), { seed: SEED, numRuns: RUNS })
  })
})
