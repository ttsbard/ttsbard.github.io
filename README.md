# TTSBard Website

English and Russian landing pages for [TTSBard](https://github.com/ttsbard/TTSBard),
hosted on GitHub Pages at **https://ttsbard.github.io/**.

The site uses plain HTML and CSS in `site/`, with no build step or dependencies.
Keep both language versions in sync.

## Local preview

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory site
```

Open [English](http://127.0.0.1:4173/) or [Russian](http://127.0.0.1:4173/ru/).

## Validate

```sh
node scripts/check-site.mjs
```

## Publish

The site is currently a draft. After content and design approval, remove
`noindex` from both pages and run:

```sh
node scripts/check-site.mjs --release
```

Run **Landing / GitHub Pages** in GitHub Actions from `main` with `deploy=true`.
Only `site/` is published. Application downloads and documentation live in the
[application repository](https://github.com/ttsbard/TTSBard).

See the [roadmap](docs/roadmap.md) for progress and remaining launch tasks.
