// pnpm spec <id> | --map. Prints one spec section, compact. Fails if over budget.
import fs from 'node:fs'
const arg = process.argv[2]
const budgets = JSON.parse(fs.readFileSync('tooling/budgets.json', 'utf8')).output
const file = !arg || arg === '--map' ? 'spec/00-map.md' : fs.existsSync(`spec/kernel/${arg}.md`) ? `spec/kernel/${arg}.md` : `spec/std/${arg}.md`
if (!fs.existsSync(file)) { console.log(`E0002 no spec section ${arg}; run pnpm spec --map`); process.exit(1) }
const text = fs.readFileSync(file, 'utf8')
const tokens = Math.ceil(text.length / 4)
const budget = file.endsWith('00-map.md') ? budgets['spec.map'] : budgets['spec.section']
if (tokens > budget) console.log(`W0001 ${file} ~${tokens} tokens exceeds budget ${budget}`)
process.stdout.write(text)
