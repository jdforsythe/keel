// Clause: optional and nullable are distinct (E1102 reasoning). Seed 1337.
import { describe, expect, expectTypeOf, it } from 'vitest'
import fc from 'fast-check'
import { s } from '@keel/schema'
import { RUNS, SEED } from './fixtures'

const Opt = s.object({ a: s.string().optional() })
const Nul = s.object({ a: s.string().nullable() })
const Both = s.object({ a: s.string().optional().nullable() })

describe('k.schema optional vs nullable', () => {
  it('optional: absent key passes', () => expect(Opt.parse({}).ok).toBe(true))
  it('optional: present value passes', () => expect(Opt.parse({ a: 'x' }).ok).toBe(true))
  it('optional: null fails', () => expect(Opt.parse({ a: null }).ok).toBe(false))
  it('nullable: null passes', () => expect(Nul.parse({ a: null }).ok).toBe(true))
  it('nullable: present value passes', () => expect(Nul.parse({ a: 'x' }).ok).toBe(true))
  it('nullable: absent key fails', () => expect(Nul.parse({}).ok).toBe(false))
  it('optional+nullable: absent passes', () => expect(Both.parse({}).ok).toBe(true))
  it('optional+nullable: null passes', () => expect(Both.parse({ a: null }).ok).toBe(true))
  it('optional+nullable: value passes', () => expect(Both.parse({ a: 'x' }).ok).toBe(true))
  it('optional+nullable: wrong type fails', () => expect(Both.parse({ a: 1 }).ok).toBe(false))

  it('encode keeps absent key absent for optional', () => {
    expect('a' in (Opt.encode({}) as object)).toBe(false)
  })
  it('encode keeps null as null for nullable', () => {
    expect(Nul.encode({ a: null })).toEqual({ a: null })
  })
  it('decode does not turn null into absent or absent into null', () => {
    const o = Opt.decode({})
    const n = Nul.decode({ a: null })
    expect(o.ok && 'a' in (o.value as object)).toBe(false)
    expect(n.ok && (n.value as { a: unknown }).a).toBeNull()
  })

  it('types: optional infers an optional key without null', () => {
    type T = s.infer<typeof Opt>
    expectTypeOf<T>().toEqualTypeOf<{ a?: string }>()
  })
  it('types: nullable infers a required key with null', () => {
    type T = s.infer<typeof Nul>
    expectTypeOf<T>().toEqualTypeOf<{ a: string | null }>()
  })
  it('types: optional and nullable infer differently', () => {
    expectTypeOf<s.infer<typeof Opt>>().not.toEqualTypeOf<s.infer<typeof Nul>>()
  })

  it('gen() for optional never yields null', () => {
    fc.assert(fc.property(Opt.gen(), (v) => (v as { a?: unknown }).a !== null), { seed: SEED, numRuns: RUNS })
  })
  it('gen() for nullable always has the key', () => {
    fc.assert(fc.property(Nul.gen(), (v) => 'a' in (v as object)), { seed: SEED, numRuns: RUNS })
  })
})
