# Readiness for the outside reviews

What must be true before the accessibility audit and the penetration test start, from W4 step 2 and the P1 exit criteria in `tasks/p1/PLAN.md`. Each item is marked as the repository stands at the commit in `verified:` below: **done**, **partial** or **open**, with what shows it. Testers should find what nobody knows yet, so nothing they are sent to test may already be on our own list.

## Both reviews

| # | Item | State | What shows it |
| --- | --- | --- | --- |
| R1 | A firm chosen and paid for each review | open | The project's owner decides; `docs/reviews/vendors.md` holds the shortlist and the questions for the first call. |
| R2 | The weakness backlog cleared | open | `tasks/p1/weaknesses.md` holds 88 open lines in A1 (fix before public), 109 in A2, 24 in B (docs sweep) and 2 that need a person. The P1 exit criterion is zero open lines. A1 holds security, privacy and accessibility lines a tester would find first. |
| R3 | A staging host with https, the production environment (`KEEL_SECRET` of 32 bytes or more, an https `KEEL_ORIGIN`), and a proxy in front that limits requests per client address | open | No staging host exists. The plan deploys nothing until the weakness gate (R2) is green. https matters to the test: over plain http the caller cookie loses `__Host-` and `Secure`, a limit the threat model already publishes. The threat model also names the proxy as the place for per-address limits, so staging without one tests a setup we tell people not to run. |
| R4 | The reference app deployed | open | `apps/golden-3` does not exist; it waits on the agent docs and skills (W5). The stand-ins `apps/household` and `apps/golden-2` build and have generated deploy files (`apps/household/deploy/compose.yaml`), and neither is deployed. |
| R5 | Seeded data and test accounts | open | No seed script exists for either stand-in; seeding lives only in their tests (`apps/household/test/household.ts`). The pen test needs three household accounts across two households and two golden-2 accounts, each with an API token; the audit needs one account per app. |
| R6 | The scaffold output built and deployed | open | `keel scaffold project` writes `client`, `node` and `static` projects; none is generated, built and deployed for review. |
| R7 | The docs site built and deployed | open | Not built; W8 waits on the freeze and the human docs. Both scopes add it when it exists. |
| R8 | An evidence bundle per app | open | `keel evidence` exists (k.evidence); no bundle has been written for a stand-in app, and no `KEEL_EVIDENCE_KEY` is set up for signing them. |
| R9 | Source access for the firms | done | The repository is public on GitHub. The scopes name a fixed commit at kickoff. |
| R10 | A technical contact named | open | `tasks/p1/TODO.md` "Needs a human" lists an address a person answers; the scopes name the contact in the engagement letter. |

## Penetration test

| # | Item | State | What shows it |
| --- | --- | --- | --- |
| P1 | `SECURITY.md` | partial | It exists and sends reports to GitHub's private vulnerability reporting, which is turned off on the repository today (the API answers `{"enabled":false}`). Turn it on, or give the address R10 names. |
| P2 | `docs/THREAT-MODEL.md` current | partial | See below. |
| P3 | Each claim in `docs/reviews/pen-test-scope.md` (C1 to C26) still matches the threat model and its spec section at the commit named at kickoff | open | Re-read the claims table against the threat model on that day. |

### What the threat model lacks

Read against RFC 0230 to 0236 (`docs/rfc/`):

- **RFC 0230, scrub views and event caps.** Present: the decoded views, the 65,536-byte scope cap, the lost-listener mark, the slashes taken into a path mark and the 1,048,576-byte event cap are all stated.
- **RFC 0231, check security rules.** Absent. Nothing states E1016 (a type reference directive or a foreign `ImportMeta` declaration, so `import.meta.env` is typed by Keel alone), E1015 (a relative import resolving outside the project), E1107 judging on client reach and refusing a state schema it cannot read, E1108 consulting only `@keel/std-*` formats, the stated limit of E1570 and E1571 (a URL they cannot read is not reported, and the policy blocks it at run time), or the scaffold refusing a file with more than one hard link. These are what make `keel check` a security boundary, and the threat model says the gate only through the bundle rule.
- **RFC 0232, router and identity hardening.** Absent. The Identity section names E1580 and not E1593 (an `identityMount` call outside `identity.ts`'s default export is an error) or E1579 refusing a mount path at or under `/assets`.
- **RFC 0233 and RFC 0234, a11y items per page and static contrast.** Accessibility, not threat model text; `docs/A11Y-TARGET.md` covers contrast from tokens.
- **RFC 0235, ledger integrity.** Absent, and it belongs in a threat model only where an auditor relies on the bundle: the evidence bundle is described as signed and free of app values, and not as resting on a recorded test run. A tester checking `keel evidence` would read k.evidence and k.ledger-items for that.
- **RFC 0236, personal data and plain data.** Present: plain data at parse, undeclared keys unrecorded in sessions, and the process-wide anonymous stream count with the signed-in exception.

Beyond those RFCs, the document is titled "Threat model (seed)" and ends "Grows per package." Under Durable storage it names `@keel/std-db` and not `@keel/std-postgres`, the app data battery that the stand-in apps' Postgres data goes through. A tester reads the title and the last line as a draft; both go before the document is sent.

## Accessibility audit

| # | Item | State | What shows it |
| --- | --- | --- | --- |
| A1 | Every page route of the stand-ins rendered with its a11y checks | partial | `tasks/p1/TODO.md` marks household done; golden-2's page routes have a11y agreement files (`apps/golden-2/.keel/a11y.json`). RFC 0233's per-route items are in a running lane. |
| A2 | `docs/A11Y-TARGET.md` current | done | It states the static and render checks and the focus ring; `node tooling/docs-freshness.mjs` passes it. |
| A3 | The catalog page in all three locales on staging | open | Waits on R3 and R4. |

## Order

R1 can start today: the firms' lead times are the longest of anything left. R2, the threat model edits, P1 and R5 are ours and can run while quotes come back. R3, R4 and R6 wait on R2. Book the review windows for after R2 closes, and send each firm its scope document with the quote request.

subject: docs/THREAT-MODEL.md SECURITY.md docs/A11Y-TARGET.md tasks/p1/weaknesses.md tasks/p1/PLAN.md
verified: 5132ef10
