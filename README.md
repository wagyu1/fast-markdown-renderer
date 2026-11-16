# fast-markdown-renderer

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/wagyu1/fast-markdown-renderer/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/wagyu1/fast-markdown-renderer/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A drop-in replacement for `marked` 18.1.3 that renders byte-identical HTML with
less CPU time, entered in [make.fun](https://make.fun)'s
"Make Markdown rendering faster" bounty.

## What it does

The entry forks `marked`'s TypeScript sources and keeps its grammar, so every
document renders to exactly the same HTML. The work is on the hot paths only:

- the inline-text rule gets a hand-written scanner (table lookups, no lazy
  `[\s\S]*?` retry per character) that falls back to the regular expression for
  anything a byte table cannot decide;
- the daemon runs rules with full regex flags instead of a fixed flag mask;
- the mask pass skips its three whole-text patterns when the characters they
  need are absent;
- the list tokenizer scans for the next line and the indentation with
  `indexOf` and character codes instead of splitting and re-testing.

## Run

```
node main.ts
```

with `MAKEFUN_INPUT_DIR` holding `cases.json` and `MAKEFUN_OUTPUT_DIR` receiving
`html.json`.

## Layout

- `main.ts` — entrypoint, reads the cases, writes the HTML, no other I/O.
- `parse.js` — the exported `parse(markdown)` the driver calls.
- `src/` — forked and annotated `marked` 18.1.3 TypeScript sources.
- `vendor/marked/` — the upstream ESM build and its licence, kept for
  reference and for the baseline comparison.
