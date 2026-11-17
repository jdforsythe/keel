---
"@keel/server": patch
---

A request's secret set takes no more values once their written forms pass the scrub's 2,000,000-character cap, so a long live stream's set stops growing there; past the cap each of its log texts is one `[secret]` mark.
