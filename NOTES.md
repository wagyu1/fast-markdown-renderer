# Profile notes

Starting point: gate `CASES 720/720 PASS`; 7-round median 2704 ms baseline, 2468 ms current.

`node --cpu-prof`, five full passes over the 720 practice cases. Self time below aggregates samples by function name (regular-expression execution is attributed to its pattern).

1. `list` — 1870.1 ms
2. `#n` (inline emphasis masking) — 852.0 ms
3. inline-text regular expression — 698.6 ms
4. `emStrong` — 632.6 ms
5. anonymous tokenizer/list callbacks — 556.8 ms

Next hottest named functions: `#t` 520.3 ms, `#e` 459.1 ms, `fe` 386.8 ms, `blockTokens` 299.1 ms, `lex` 272.5 ms.
