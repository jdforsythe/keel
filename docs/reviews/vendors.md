# Vendor shortlist for the two reviews

Looked up on 2026-11-25. Each claim cites the page it came from. A price appears only where a page states one; "not published" means the page we read states none. Firm pages change, so confirm every term on the first call. The scopes the firms quote against are `docs/reviews/a11y-audit-scope.md` and `docs/reviews/pen-test-scope.md`.

## Accessibility audit

| Firm | What they do | Pricing | Lead time | Retest | Quote |
| --- | --- | --- | --- | --- | --- |
| Accessible.org (US) | Manual audits of sites and web apps against WCAG 2.1 AA or 2.2 AA; NVDA, JAWS and/or VoiceOver in Chrome and Safari ([pricing](https://accessible.org/pricing/)) | $100 to $250 per primary page or screen, $25 to $100 per light one; "Most accessibility audits cost between $1,250 and $2,750"; WCAG edition VPAT $350 plus the audit ([pricing](https://accessible.org/pricing/)) | Not published; expedited service $250 to $750 ([pricing](https://accessible.org/pricing/)) | No retest named; fix validation is technical support at $195 an hour, 2 hours minimum ([pricing](https://accessible.org/pricing/)) | Email on the pricing page, or its cost calculator ([pricing](https://accessible.org/pricing/)) |
| TetraLogical (UK) | Assessments in three packages (Foundations, Core, Accelerate), with common assistive technologies; names "design systems, component libraries" in scope; names WCAG and EN 301 549 without a version ([assessments](https://tetralogical.com/services/assessments/)) | Not published | Not published | Not stated | hello@tetralogical.com ([assessments](https://tetralogical.com/services/assessments/)) |
| AbilityNet (UK charity) | Audits against WCAG 2.2; a Digital Accessibility Review for up to 10 key pages or components, or a full audit; VPAT/ACR available ([audit](https://abilitynet.org.uk/accessibility-services/products-and-services/accessibility-audit)) | Review "a fixed £4,950 plus VAT for up to 10 key pages/components"; full audit not published ([audit](https://abilitynet.org.uk/accessibility-services/products-and-services/accessibility-audit)) | 1 to 2 weeks for a small audit, 3 to 4 weeks for an in-depth one ([audit](https://abilitynet.org.uk/accessibility-services/products-and-services/accessibility-audit)) | Re-audit recommended after updates; not stated as included ([audit](https://abilitynet.org.uk/accessibility-services/products-and-services/accessibility-audit)) | Form on the page, or sales@abilitynet.org.uk ([audit](https://abilitynet.org.uk/accessibility-services/products-and-services/accessibility-audit)) |
| Knowbility (US nonprofit) | Expert manual testing of sample screens, "often assisted by native screen reader users"; the audit page cites WCAG 2.1 AA and Section 508 ([audits](https://knowbility.org/services/audits)) | Not published | Not published | Re-testing of sample pages "at ½ the testing rate", then a letter of validation ([audits](https://knowbility.org/services/audits)) | "Submit a Project Inquiry" on the page ([audits](https://knowbility.org/services/audits)) |
| Hassell Inclusion (UK) | Standard Audit of agreed pages against "WCAG 2.1/2.2 AA"; Live Audit of three journeys over two half-days ([audits](https://hassellinclusion.com/audits/)); a Design System Accessibility Review ([design systems](https://www.hassellinclusion.com/design-system-accessibility-review/)) | Not published | Not published | Not stated | "Talk with us about an audit" ([audits](https://hassellinclusion.com/audits/)) |
| TPGi (US) | Manual testing against every WCAG 2.2 criterion; recommends JAWS with Chrome, NVDA as the alternative, VoiceOver with Safari on iOS ([WCAG 2.2 testing](https://www.tpgi.com/accessibility-testing-with-wcag-2-2/)) | Not published | Not published | Not checked | Not checked |
| Deque (US) | Manual code inspection, keyboard and screen reader testing; Windows, NVDA and Chrome as its default scope ([testing](https://www.deque.com/wcag/testing/)) | Not published | Not published | Not checked | Not checked |

Fit for a framework: TetraLogical and Hassell are the two that name design systems or component libraries, which is what `@keel/ui` and `@keel/std-headless` are. Knowbility is the one with a stated retest price. Accessible.org is the one with a stated price range, and it names the screen readers it uses; nothing on its page shows design-system or open-source work. TPGi and Deque are large vendors whose pages we read for method only; we found no sign that they take an engagement this size.

## Penetration test

| Firm | What they do | Pricing | Lead time | Retest | Quote |
| --- | --- | --- | --- | --- | --- |
| Cure53 (Germany) | Black-box and white-box tests and code audits; JavaScript among tested languages; maintains DOMPurify; reports published on the maintainers' request ([home](https://cure53.de/)); public open-source reports such as noble ([report](https://cure53.de/audit-report_noble-crypto-libs.pdf)) | Not published | Not published | Not stated; "Our assignments don't end with the report submission" ([home](https://cure53.de/)) | hello@cure53.de ([home](https://cure53.de/)) |
| 7ASecurity (international) | Penetration tests and code audits; clients quoted include OSTIF, the Linux Foundation and Thunderbird ([home](https://7asecurity.com/)); audited nvm for OSTIF and the OpenJS Foundation ([OSTIF](https://ostif.org/nvm-audit-complete/)) | Not published; "Scoped to your requirements and budget" ([home](https://7asecurity.com/)) | Not published | "7ASecurity offers free fix verification" ([home](https://7asecurity.com/)) | sales@7asecurity.com, free consultation ([home](https://7asecurity.com/)) |
| X41 D-Sec (Germany) | Penetration tests, source code audits, fuzzing; public reports include Ruby on Rails (2025, for OSTIF) and Backstage ([home](https://x41-dsec.de/)) | Not published | Not published | No retest service described; a published retest report exists for one client ([home](https://x41-dsec.de/)) | info@x41-dsec.de ([home](https://x41-dsec.de/)) |
| Radically Open Security (Netherlands, non-profit) | Code audits and web penetration tests among its services ([services](https://www.radicallyopensecurity.com/services/)); describes itself as non-profit ([home](https://www.radicallyopensecurity.com/)); tested OONI, funded by OTF ([OONI](https://ooni.org/post/ooni-security-audit/)) | Not published | Not published | Not stated | info@radicallyopensecurity.com ([home](https://www.radicallyopensecurity.com/)) |
| Doyensec (US, Italy) | Web and API testing with manual source review, Electron, GraphQL ([home](https://doyensec.com/)) | Not published | Not published | Not stated | info@doyensec.com ([home](https://doyensec.com/)) |
| Ada Logics (UK) | Code auditing, fuzzing, penetration tests ([home](https://adalogics.com/)); Node.js fuzzing and threat-model audit for OSTIF ([OSTIF](https://ostif.org/node-js-fuzzing-audit-complete/)) | Not published | Not published | Not stated | Contact form; replies "within one business day" ([home](https://adalogics.com/)) |
| Software Secured (Canada) | Web and API penetration tests, secure code review, threat modelling ([pricing](https://www.softwaresecured.com/pricing)) | Web and API pentest "STARTS AT $10,800 USD"; secure code review "STARTS AT $9,300 USD"; threat modelling "STARTS AT $12,400 USD" ([pricing](https://www.softwaresecured.com/pricing)) | Not published | Manual services list "3 rounds over 12 months"; the package table shows 1, 3 or unlimited rounds by tier, so confirm ([pricing](https://www.softwaresecured.com/pricing)) | "Book a Consultation" ([pricing](https://www.softwaresecured.com/pricing)) |
| Cobalt (US, a platform) | Penetration testing as a service ([pricing](https://www.cobalt.io/pricing)) | Autonomous web pentest "$3,500 per test", a limited offer that must start and finish before 2026-12-31; human-led tiers not published ([pricing](https://www.cobalt.io/pricing)) | Starts within 3, 2 or 1 business days by tier ([pricing](https://www.cobalt.io/pricing)) | "unlimited on-demand retesting throughout your contract term" ([pricing](https://www.cobalt.io/pricing)) | "get a quote" ([pricing](https://www.cobalt.io/pricing)) |

Fit for a framework: Cure53, 7ASecurity, X41 D-Sec and Ada Logics have public audits of open-source projects in the JavaScript or web framework space (DOMPurify's maintainers, nvm, Ruby on Rails, Node.js). Radically Open Security is non-profit and works on funded open-source audits. Software Secured and Cobalt publish prices and retest terms but show no open-source or framework work; Cobalt's priced offer is an automated test, which does not read source and cannot test the claims in `docs/THREAT-MODEL.md`. We use the two as price anchors, not as candidates.

## Programmes that fund or subsidize audits

Every programme below asks for an open-source licence. Keel's `LICENSE` states all rights reserved until the public release, and the licence is chosen at launch, so none of these applies before the licence is set.

| Programme | Covers | Live on 2026-11-25 | Requires |
| --- | --- | --- | --- |
| OSTIF | Security audits: scoping, sourcing auditors and bids, fix support, then the report published ([get an audit](https://ostif.org/get-an-audit/)) | Intake form open; no deadline stated ([get an audit](https://ostif.org/get-an-audit/)) | No eligibility listed. "initial audits could range anywhere from $30k to $200k"; OSTIF helps "raise funds and source sponsors", and does not say it pays. The report is published after fixes ([get an audit](https://ostif.org/get-an-audit/)) |
| GitHub Secure Open Source Fund | $10,000 per project in three parts, a 3-week security programme, GitHub Security Lab office hours ([fund](https://github.com/open-source/github-secure-open-source-fund)) | "open on a rolling basis" ([fund](https://github.com/open-source/github-secure-open-source-fund)) | A maintainer 18 or over in a GitHub Sponsors region, an open-source licence, "community traction", a clear governance structure ([fund](https://github.com/open-source/github-secure-open-source-fund)). Not an audit; the money could pay part of one. |
| OTF User Experience and Discovery Lab | Free accessibility audits among its services; "All costs associated with Lab engagements will be taken on by OTF"; Accessibility Lab is the partner that names audits ([lab](https://www.opentech.fund/labs/uxd-lab/)) | "Apply Now" links, no deadline, no statement that it is open ([lab](https://www.opentech.fund/labs/uxd-lab/)) | Technology that falls within OTF's remit and advances internet freedom ([lab](https://www.opentech.fund/labs/uxd-lab/)). A general web framework is outside it. |
| OTF Security Lab | Free security audits ([lab](https://www.opentech.fund/labs/security-lab/)) | No status or deadline stated | The same internet-freedom remit. Outside it. |
| Sovereign Tech Resilience | Security audits, technical debt, supply chain ([program](https://www.sovereign.tech/programs/bug-resilience)) | Rolling applications ([program](https://www.sovereign.tech/programs/bug-resilience)) | Open-source licence; a project "under-supplied or threatened" and scored on relevance, prevalence and vulnerability ([criteria](https://www.sovereign.tech/programs/bug-resilience/criteria)). A new framework with no users does not meet it. |

Not available now: NGI Zero Review's WCAG audits ended on 31 July 2026 and serve only NLnet grantees ([NGI Zero Review](https://nlnet.nl/NGI0/review/)); NLnet's audit support with Radically Open Security comes with an NLnet grant ([NGI Assure](https://nlnet.nl/thema/NGIAssure.html)); Alpha-Omega lists no application process ([home](https://alpha-omega.dev/)); Google's open-source reward programme pays for bugs in Google's own projects ([OSS VRP](https://bughunters.google.com/open-source-security)).

## Recommendation

Accessibility:
1. **TetraLogical.** It names design systems and component libraries in scope, which is where most of Keel's accessibility lives. Ask for the price and whether WCAG 2.2 and a retest are part of the package.
2. **AbilityNet.** A charity with a published fixed price for a first pass (£4,950 plus VAT for up to 10 pages or components), WCAG 2.2 stated, and a stated lead time of 1 to 4 weeks. The stand-in apps have 11 page routes before the scaffold output, so ask for a full audit quote and whether the retest is in it.
Knowbility is the alternate if either cannot start in time: its retest terms are the clearest of any firm, and its audit page needs a WCAG 2.2 answer.

Penetration test:
1. **Cure53.** Its browser security and DOMPurify work match Keel's strongest claims: the content security policy, Trusted Types and escaped output. It does white-box code audits and publishes open-source reports on request.
2. **7ASecurity.** Source audits of open-source Node.js projects (nvm, for OSTIF and the OpenJS Foundation) and free fix verification on its own page, which covers the retest the scope asks for.
X41 D-Sec is the alternate: its Ruby on Rails audit is the closest public match to a framework review.

Ask each recommended firm for a quote against the scope document the same week; the two quotes per review set the price, since no shortlisted firm publishes one for this kind of work.

## Three questions for the first call

1. When could you start, how many person-days does the scope take, and what is the price, with the retest priced inside it?
2. Who would test, and what have they reviewed that is like this: a web framework or component library read from its source, rather than one deployed site?
3. May we publish the final report, or a summary you approve, and how long after the report does the retest stay open?

## What we could not verify

- Fable (makeitfable.com): its pricing page did not load; a search result quoted a project price we could not confirm, so it is left out.
- Trail of Bits, NCC Group, Include Security, Bishop Fox, Quarkslab, Securing, Shielder and Atredis: their pages were not read. Trail of Bits does OSTIF audits ([blog](https://blog.trailofbits.com/2024/01/09/securing-open-source-infrastructure-with-ostif/)); nothing else about them is checked.
- TPGi, Deque, Level Access, Nomensa, Intopia, Equalize Digital and Accessible360: audit or pricing pages failed to load or were read through search results only, so their retest and quote routes are unchecked.
- No firm page states a discount for open-source projects; ask.
- Minimum engagement size is not stated by any firm.
- Whether the OTF labs are taking applications today; their pages state no deadline and no closure.
- Claims about Radically Open Security's services, Doyensec and Ada Logics rest on their home pages; we read no public report by Doyensec.

subject: docs/reviews/a11y-audit-scope.md docs/reviews/pen-test-scope.md
verified: 5132ef10
