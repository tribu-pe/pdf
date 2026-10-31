# AGENTS.md

`@tribu-pe/pdf` draws the Printed Representation (representación impresa) of the documents [Tribu](https://github.com/tribu-pe/tribu) issues, with pdfmake. It is a separate package so Tribu stays light: whoever doesn't need a PDF doesn't install pdfmake.

Tribu's rules apply here too: read [tribu's AGENTS.md](https://github.com/tribu-pe/tribu/blob/main/AGENTS.md). The ones that matter most:

1. **SUNAT facts need a source.** What a Printed Representation must show comes from `docs/research/printed-representation-2026-11.md` in the tribu repo. Never from memory.
2. **Secrets never enter the repository or the logs.** Test Records are made with a certificate generated in memory (`test/support/records.ts`).
3. **Code, comments and docs are in English.** `README.es.md` is the Spanish copy of `README.md`; change them together.
4. **Commit or push only when asked.** Never work directly on `main`.

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies. Versions younger than 7 days are refused, except `tribu` (`pnpm-workspace.yaml`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | Biome check / check and fix |
| `pnpm test` | Vitest: unit tests and PDFs of every variation, from Records Tribu issues against `fakeSunat()` |
| `pnpm check` | typecheck + lint + test |
| `pnpm build` | tsdown → `dist/` |
| `pnpm examples` | Build, then write `examples/*.pdf`: every variation in every format. Look at them after changing a template |

## Layout

| File | Role |
|---|---|
| `src/record.ts` | The Record shape this package reads: structural, so plain JSON from a database works |
| `src/print-data.ts` | Record → `PrintData`, the text a Printed Representation shows. The one place that knows SUNAT |
| `src/words.ts`, `src/format.ts` | Amount in words, amounts and dates |
| `src/qr.ts` | SUNAT's QR rules (`QR_RULES`) and `sunatQr`, a QR that always meets them |
| `src/rules.ts` | The verifier `pdf()` runs on every template; each rule is listed in `docs/sunat-rules.md` |
| `src/blocks.ts` | Pieces a template combines |
| `src/templates.ts` | `a4`, `ticket80`, `ticket58`, `ticket(width)` |
| `src/theme.ts` | Colours, fonts and size, validated |
| `src/render.ts` | The only file that imports pdfmake: its own instance, no network or disk access |
| `src/pdf.ts` | `pdf()` and `prepare()` |
| `fonts/` | Montserrat (SIL OFL, `fonts/OFL.txt`) |

Templates only lay out `PrintData`; anything SUNAT requires is computed in `print-data.ts` and checked in `rules.ts`, so no template, including a user's, can leave it out. A new SUNAT requirement means a rule in `rules.ts`, a line in `docs/sunat-rules.md` and a test in `test/rules.test.ts`.
