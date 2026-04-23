# citebeam.bbd.sh

**Citebeam** is the AEO (Answer Engine Optimization) service line of [bbd.sh studio](https://www.bbd.sh). This repo is the source for https://citebeam.bbd.sh.

> When a customer asks an AI assistant for a product recommendation, does the AI mention your brand — or a competitor's? Citebeam is the service that makes sure it's yours.

## What's inside

- **Astro 5** static site, deployed via Cloudflare Pages
- **Tailwind CSS** + Typography plugin
- **i18n**: English at `/`, Chinese at `/zh/` (not a runtime abstraction — each page is written/rewritten per language)
- **Schema.org** Organization + Service + WebSite markup, `sameAs` cross-linking to bbd.sh parent
- **Guides**: 5 long-form AEO primers (EN + ZH each)

## Tracked AI platforms

ChatGPT · Claude · Perplexity · Google AI Overviews · Doubao 豆包 · Kimi · Tongyi 通义

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static build → dist/
pnpm preview    # preview built site
```

## Deploy

Cloudflare Pages builds from `main` branch, publishes to `citebeam.bbd.sh`. Preview deploys on every branch/PR.

## Related

- **Parent studio**: https://www.bbd.sh
- **Methodology docs** (private): `/home/ubuntu/winless/CITEBEAM_PLAYBOOK.md`
- **Brand entity pack**: `BRAND_ENTITY_PACK.md` in parent repo
- **Brand assets**: `/home/ubuntu/winless/bbd-brand-assets/`

## License

Source code is not open for reuse at this time. Content (guide essays, playbook methodology) is ours. This repo is public for transparency and as an example of our engineering practice.
