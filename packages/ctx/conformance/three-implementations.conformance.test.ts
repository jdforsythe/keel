// k.ctx: "every capability has all three implementations"
import { describe, expect, test } from 'vitest'
import { createCtx, register, capabilities } from '@keel/ctx'

const SEED = 1337
const MODES = ['real', 'shell', 'sim'] as const
const KERNEL: Record<string, string[]> = {
  clock: ['now'],
  random: ['uuid', 'float'],
  net: ['fetch'],
  storage: ['get', 'set'],
}

register('probe3', {
  real: () => ({ ping: () => 'real' }),
  shell: () => ({ ping: () => 'shell' }),
  sim: () => ({ ping: () => 'sim' }),
})
const METHODS: Record<string, string[]> = { ...KERNEL, probe3: ['ping'] }

function cap(mode: (typeof MODES)[number], name: string): unknown {
  return Reflect.get(createCtx({ mode, seed: SEED }), name)
}

describe('k.ctx three implementations', () => {
  test('capabilities() includes the four kernel capabilities', () => {
    expect(capabilities()).toEqual(expect.arrayContaining(Object.keys(KERNEL)))
  })

  test('every capability is a non-null object with its methods in every mode', () => {
    for (const name of capabilities()) {
      const methods = METHODS[name]
      expect(methods, `no interface known for ${name}`).toBeDefined()
      for (const mode of MODES) {
        const impl = cap(mode, name)
        expect(impl, `${name}/${mode}`).not.toBeNull()
        expect(typeof impl).toBe('object')
        for (const m of methods ?? []) {
          expect(typeof Reflect.get(Object(impl), m), `${name}.${m}/${mode}`).toBe('function')
        }
      }
    }
  })

  test('the three implementations are distinct objects', () => {
    for (const name of capabilities()) {
      const [r, sh, si] = MODES.map((m) => cap(m, name))
      expect(r).not.toBe(sh)
      expect(r).not.toBe(si)
      expect(sh).not.toBe(si)
    }
  })

  test('registered capability is exposed as ctx[name] and listed', () => {
    expect(capabilities()).toContain('probe3')
    const ping = (mode: (typeof MODES)[number]) => Reflect.apply(Reflect.get(Object(cap(mode, 'probe3')), 'ping'), undefined, [])
    expect(MODES.map(ping)).toEqual(['real', 'shell', 'sim'])
  })
})
