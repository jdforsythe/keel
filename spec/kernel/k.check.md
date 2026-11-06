# k.check: Checker and diagnostics
status: proposed

**Pipeline.** TS strict -> structure lint -> schema checks -> reactive/store rules -> a11y on rendered output -> budgets. One pass, incremental, under 1s warm on golden app 1.

**Diagnostics.** Per OUTPUT.md. Codes: E1xxx kernel rules, E2xxx stdlib, W for warnings, I for info. `keel explain <code>` prints <= 120 tokens with the fix pattern.

**Registry.** `check.rule({ code, match, message, fix })` for stdlib modules.

**Conformance.** Every code has an explain entry and a fixture that triggers it; fix diffs apply cleanly and make the fixture pass; output budgets hold on the golden app.
