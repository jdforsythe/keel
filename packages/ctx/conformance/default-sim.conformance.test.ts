// k.ctx: "keel test runs under sim by default"
// The `keel test` runner wiring itself is untestable here (harness clause); only the createCtx default is checked.
import { expect, test } from 'vitest'
import { createCtx } from '@keel/ctx'

test('createCtx({}) defaults to sim when KEEL_TEST=1', () => {
  const prev = process.env.KEEL_TEST
  process.env.KEEL_TEST = '1'
  try {
    const clock = createCtx({}).clock
    expect('advance' in clock).toBe(true)
    expect(clock.now()).toBe(0)
  } finally {
    if (prev === undefined) delete process.env.KEEL_TEST
    else process.env.KEEL_TEST = prev
  }
})
