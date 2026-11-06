// Blocks edits under packages/*/conformance/ unless branch or HEAD message carries rfc:NNNN.
import { execSync } from 'node:child_process'
const input = JSON.parse(await new Response(process.stdin).text())
const path = input?.tool_input?.file_path ?? ''
if (!/packages\/[^/]+\/conformance\//.test(path)) process.exit(0)
const branch = execSync('git rev-parse --abbrev-ref HEAD').toString()
const msg = execSync('git log -1 --pretty=%s').toString()
if (/rfc:\d{4}/.test(branch + msg)) process.exit(0)
console.log('E0001 conformance edit requires rfc:NNNN on branch or commit; run /rfc')
process.exit(2)
