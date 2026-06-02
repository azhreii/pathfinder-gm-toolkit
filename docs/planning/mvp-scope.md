# PF2e GM Toolkit — MVP Scope

## What MVP Means Here

MVP is the end of Phase 1. It is the first version a paying subscriber
can install and get real value from at their actual table. Phase 0 (the
walking skeleton) already exists; MVP extends it into genuine Foundry
integration. A Phase 0-only release would not justify a paid tier.

## What Is In MVP

### Build infrastructure
esbuild pipeline, source maps, production build script, GitHub Actions
release pipeline, branch protection, Discord webhook error reporting.
This is not a user-facing feature but it is a prerequisite for everything
else. It ships before any Phase 1 feature work begins.

### Party auto-detection
Party level and size read from active player characters on the connected
world. Derived values displayed with an override field. Falls back
gracefully when no characters are assigned.

### Terrain selection (always available)
Terrain dropdown is always present and always usable. When the active
scene has terrain metadata set by the module, that value pre-populates
the dropdown. When it does not — which is the common case for GMs using
third-party maps — the dropdown starts empty and the GM selects manually.
No degraded experience for GMs without tagged scenes.

### Encounter → tokens on canvas
Generated encounter results include a "Place Tokens" button. Clicking it
creates tokens on the active scene from the selected compendium entries,
hidden from players by default. A toggle lets the GM place them visible
if needed. If no scene is active, the button is disabled with an
explanation.

### Combat tracker integration
Optional "Add to Combat" checkbox on the place tokens flow. When checked,
created tokens are added to the active combat encounter. If no combat
exists, one is created.

### Compendium linking
Creature names in encounter results are clickable. Clicking opens the
creature's compendium sheet directly. GMs can review stat blocks without
leaving the module window.

### NPC → Foundry Actor with archetype selection
NPC generation adds an archetype picker step after flavor generation.
The picker shows compendium NPCs filtered by the selected creature level,
grouped by broad category (Combatant, Spellcaster, Non-combatant, etc.).
GM picks one or skips. The resulting Actor has the chosen mechanical base
with generated flavor fields (name, biography, personality notes) applied
on top.

### NPC creature level selection
Defaults to average active party level. GM can override before generation.
Level filters the archetype picker and will filter shop inventory in Phase 2.

### Multi-LLM support
Settings UI for provider selection (Google Gemini, OpenAI, Mistral,
OpenAI-compatible), model name input, and API key. Switching provider
does not require a module reload. All existing AI features work against
all supported providers.

## What Is Deferred and Why

**Creature pinning (boss lock)**
Deferred to Phase 2. The encounter builder is already useful without it.
Adding pinning before the core Foundry integration is solid adds
complexity to the generation logic before the foundation is stable.

**Shop inventory generation**
Deferred to Phase 2. Requires an item compendium index. NPC actors
created in MVP will have empty inventories for merchant types; a note
in the UI tells the GM this is coming.

**World Config UI and custom ancestries**
Deferred to Phase 3. LLM config (provider, key, model) ships in MVP as
a module settings form. The full world config editor is Phase 3.

**Quick-draw mode**
Deferred to Phase 5. The workshop form serves both use cases in MVP.

**Regional encounter system**
Deferred to Phase 4. Terrain selection covers the use case adequately
for MVP.

**Sentry error tracking**
Deferred to immediately before public Forge listing. Discord webhook
covers development and early testing. Sentry is a pre-launch gate,
not a post-launch addition.

**Scene terrain tagging UI**
Deferred to Phase 3. GMs can set scene flags manually in the interim.

## The Line and Why It Is Drawn Here

MVP ends when the two core tools produce output that lands directly in
Foundry's systems without the GM having to do anything outside the
module window. Every item in scope serves that goal. Everything deferred
either builds on top of that foundation or is infrastructure that doesn't
affect the core GM experience.
