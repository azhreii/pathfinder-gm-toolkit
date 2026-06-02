# PF2e GM Toolkit — Architecture

## Summary

A client-side Foundry VTT module. No backend server. All logic runs
in the GM's browser as part of the Foundry client. External dependencies
are the LLM provider APIs (optional) and The Forge's entitlement system
(transparent to the module). Distribution and DRM are handled entirely
by The Forge's Creator Program platform.

## Module Structure

Source files in `src/` compiled to a single bundled output by esbuild.
The bundle is what ships in the release ZIP.

```
pf2e-gm-toolkit/
├── src/
│   ├── constants.js
│   ├── encounter-logic.js
│   ├── npc-logic.js
│   ├── ai-tools.js
│   ├── storage.js
│   ├── apps/
│   │   ├── encounter-app.js
│   │   ├── npc-app.js
│   │   └── world-config-app.js     (Phase 3)
│   └── main.js
├── templates/                       (Handlebars — not bundled)
├── styles/                          (CSS — not bundled)
├── data/
│   ├── terrain_mapping.json
│   └── npc_names.json
├── dist/
│   └── pf2e-gm-toolkit.bundle.js   (esbuild output, what module.json loads)
└── module.json
```

## Build Tooling

**esbuild** — single-file bundle, source maps for development builds,
minification for production builds. No transpilation needed; Foundry v13
runs in Chromium with full ES2022+ support.

Build targets:
- `npm run build` — production bundle (minified, no source maps)
- `npm run dev` — development bundle (source maps, watch mode)

GitHub Actions runs the production build on version tag push, packages
the output into a release ZIP, and creates a GitHub Release.

## Data Architecture

**Monster and item data** — read from Foundry's compendium packs at
runtime via `pack.getIndex({ fields: [...] })`. Cached in memory after
the `ready` hook fires. The module never stores a copy of compendium
data persistently; it rebuilds the in-memory index on each world load.

**World config** — stored as world-level flags on the Foundry World
document (`game.world.setFlag / getFlag`). No size concern at realistic
homebrew config volumes. Exportable as JSON for backup.

**Generated output** — Foundry owns it. Created actors, journal entries,
and tokens are standard Foundry documents. The module creates them;
Foundry stores and manages them.

**LLM API key** — stored in a world-scoped, GM-restricted module setting
(`game.settings.register` with `scope: "world"` and `restricted: true`).
Stored as plaintext in Foundry's world database. GMs are informed of
this in the settings UI and documentation.

## UI Framework

Foundry v13 ApplicationV2 for all module windows. Handlebars templates.
Two distinct UI surfaces for the encounter builder:

- **Workshop** (full blueprint form, all options, prep-oriented)
- **Quick-draw** (auto-populated, minimal overrides, Phase 5)

Both surfaces use the same underlying generation logic.

## AI Integration

Direct `fetch()` calls from the browser to the LLM provider's REST API.
No server proxy.

Supported providers:
- **Google Gemini** — `generativelanguage.googleapis.com`
- **OpenAI** — `api.openai.com` (supports CORS for browser requests)
- **Mistral** — `api.mistral.ai`
- **OpenAI-compatible** — any endpoint implementing the OpenAI chat
  completions API (Groq, LM Studio, Ollama with OpenAI wrapper, etc.)

Not supported: Anthropic Claude. Their API does not allow browser-side
requests due to CORS policy. Not deferrable — a server proxy would be
required and contradicts the no-backend constraint.

All AI calls are wrapped in try/catch. Failure falls back silently to
non-AI generation. The GM sees no error unless they have AI enabled and
the call fails, in which case a notification explains the fallback.

World lore text injected into prompts is length-capped (2,000 characters)
and stripped of control characters before being included in any API request.

## Distribution and Entitlement

The Forge Creator Program handles payment, Patreon subscription
verification, and module delivery for Forge-hosted users. The module
contains no license checking code.

GitHub releases serve as the canonical version history. `module.json`
manifest and download URLs point to GitHub releases. The Forge pulls
from these on update delivery.

For self-hosted Foundry users who are Patreon subscribers: direct
download link posted in a patron-only Patreon post. No enforcement.
Known gap, accepted at this distribution scale.

## Error Tracking

**Development:** A thin Discord webhook error reporter catches unhandled
exceptions and posts them to a private Discord channel. Zero
infrastructure, immediate visibility during build and testing.

**Production (before public launch):** Sentry browser SDK bundled via
esbuild. Errors automatically tagged with module version, Foundry version,
and PF2e system version. Free tier (5,000 errors/month) is appropriate.
Separate DSN for dev and production environments.

## CI/CD

GitHub Actions pipeline triggered on version tags (`v*`):
1. Install dependencies
2. Run esbuild production build
3. Package `dist/`, `templates/`, `styles/`, `data/`, `module.json`
   into a ZIP
4. Create GitHub Release with ZIP attached
5. `module.json` `download` field points to the new release ZIP URL

Branch protection on `main`: no direct pushes, PRs required even
for solo development.

## Alternatives Considered

**Backend server for license validation:** Rejected for launch. Adds
infrastructure maintenance burden, a failure point, and complexity the
The Forge Creator Program makes unnecessary. Revisit if self-hosted
piracy becomes a meaningful business problem.

**Claude API support:** Not feasible without a server proxy. Anthropic
does not allow browser-side CORS requests. Deferred indefinitely unless
architecture adds a backend.

**ES modules instead of classic scripts:** Foundry v13 supports ES
module imports but the ecosystem is mid-transition. Classic scripts with
an esbuild bundle is the pragmatic choice — works reliably, no import
map configuration, simpler for contributors to understand.

**Vite instead of esbuild:** Overkill for this project. esbuild is
faster, simpler to configure, and sufficient. Vite makes sense if HMR
during development becomes a priority, which it isn't yet.
