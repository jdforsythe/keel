---
"@keel/std-report": minor
"@keel/check": patch
---

`keel report <url>` with a path beyond `/` or a query reads that url as given, once: a 2xx JSON body that is a `Tally` or an array of them is printed, an array in its order, then `ok report <n> tallies`; so is a loader's answer `{ id, results }` whose `results[id]` is `{ ok: true, value }` with such a `value`, so an API route with `output: Tally` is read as it stands; any other answer is E1056, whose message leaves out the url's query. A non-empty `KEEL_REPORT_TOKEN` in the environment goes with that request as the caller cookie. A url with no path and no query reads `<url>/__keel/inspect` as before and sends no cookie. Migration: `keel report http://host/base` fetches `http://host/base`, not `http://host/base/__keel/inspect`; give the origin alone to read a dev app's inspect document.
