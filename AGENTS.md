# Repository instructions

This repository owns the bilingual static TTSBard landing site.
Record a baseline and preserve existing changes. Temporary reports and screenshots
belong in gitignored `.work/ai/`. Commits require explicit user approval.
Keep EN/RU content synchronized. Do not change the accepted layout while moving files.
Run `node scripts/check-site.mjs` after edits. Use `--app-root` to check links
against a separate application checkout. Keep draft `noindex` until visual
acceptance and publication approval; deploy is manual and gated by `--release`.
See README.md and docs/roadmap.md for the current publishing status.
