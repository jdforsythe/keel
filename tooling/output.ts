// Diagnostic model and formatters. Every script and package logs through this.
export type Diag = { kind: 'diag'; code: string; path?: string; line?: number; col?: number; message: string; fix?: string; see?: string }
export type Summary = { kind: 'summary'; ok: boolean; counts: Record<string, number>; ms: number }
export type Mode = 'compact' | 'json' | 'pretty'
export const mode = (): Mode => (process.argv.includes('--format=json') ? 'json' : process.argv.includes('--format=pretty') ? 'pretty' : (!process.stdout.isTTY || process.env.KEEL_AGENT === '1') ? 'compact' : 'pretty')
export function emit(items: (Diag | Summary)[], cap = 5): string {
  const m = mode()
  if (m === 'json') return items.map(i => JSON.stringify(i)).join('\n')
  const byCode = new Map<string, Diag[]>()
  for (const i of items) if (i.kind === 'diag') byCode.set(i.code, [...(byCode.get(i.code) ?? []), i])
  const out: string[] = []
  for (const [code, ds] of byCode) {
    for (const d of ds.slice(0, cap)) out.push(`${code} ${d.path ?? ''}${d.line ? ':' + d.line + ':' + d.col : ''} ${d.message}` + (d.fix ? `\n  fix: ${d.fix}` : ''))
    if (ds.length > cap) out.push(`... +${ds.length - cap} more ${code} (--code ${code})`)
  }
  const s = items.find(i => i.kind === 'summary') as Summary | undefined
  if (s) out.push(`${s.ok ? 'ok' : 'fail'} ${Object.entries(s.counts).map(([k, v]) => `${v} ${k}`).join(', ')} (${(s.ms / 1000).toFixed(1)}s)`)
  return out.join('\n')
}
