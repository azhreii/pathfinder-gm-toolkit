# PF2e GM Toolkit — Roadmap

Phases represent capability milestones, not sprint plans. Each phase
ends when a GM can do something meaningful they could not do before.

---

## Phase 0 — Walking Skeleton (Complete)

**What GMs can do:** Install the module, generate an encounter or NPC
using PF2e's own compendium data, save results to journal entries, use
Gemini AI enhancement with their own API key.

**What this phase established:**
- Module structure, ApplicationV2 UI, Handlebars templates
- Compendium-based monster indexing (no bundled JSON)
- Encounter generation with XP budget math and terrain filtering
- NPC flavor generation with optional AI enhancement
- Journal entry persistence
- Single LLM provider (Gemini)

**Known gaps going into Phase 1:** No Foundry integration depth —
generation produces text results, not actors or tokens. Manual party
level and terrain input. Single AI provider.

---

## Phase 1 — Foundry Integration Core (MVP)

**What GMs can do:** Generate a terrain-filtered encounter and place
hidden tokens on their canvas in under 60 seconds. Generate an NPC with
a real PF2e stat base and have a usable Actor in their world. Use any
major LLM provider. Click a creature name to open its stat block.

**Work this phase contains:**
- esbuild pipeline, GitHub Actions release automation, branch protection
- Discord webhook error reporting
- Party level and size auto-detection from active characters
- Terrain dropdown always available; auto-suggest from scene when tagged
- Token placement from encounter results (hidden by default)
- Combat tracker integration (optional, at placement time)
- Compendium sheet linking from encounter creature entries
- NPC archetype picker (compendium NPCs filtered by creature level)
- NPC creature level selection with party-average default
- NPC → creates real Foundry Actor with archetype base + generated flavor
- Multi-LLM support: OpenAI, Gemini, Mistral, OpenAI-compatible endpoints
- LLM config in module settings (provider, model, key, custom base URL)
- Input validation and lore text sanitization

**Gate for public listing:** Sentry must replace Discord webhook before
the module is listed publicly on The Forge.

---

## Phase 2 — NPC Depth and Shop System

**What GMs can do:** Pin a specific creature as the encounter boss and
have the system fill the remaining XP budget with thematically related
support. Generate a merchant NPC and have their Actor's inventory
populated with appropriate items from PF2e's equipment compendium.

**Work this phase contains:**
- Creature pinning on the encounter blueprint (boss slot)
- Supporting creature selection by trait intersection with pinned creature
- AI-assisted creature suggestions when provider is configured
- Item compendium index (built once on ready, same pattern as monster index)
- Shop type inference from NPC occupation (adjustable by GM)
- Wealth tier and location size inputs on shop config
- Item level ceiling calculation from creature level and location size
- Inventory generation: filter equipment compendium by category and level,
  populate Actor inventory on creation
- Optional AI-generated specialty item for merchant flavor

---

## Phase 3 — World Config UI

**What GMs can do:** Configure their homebrew world once — custom
ancestries with name tables, world lore text — and have that context
automatically inform AI output on every subsequent generation without
additional input. Export and import world config as JSON for backup.

**Work this phase contains:**
- World Config ApplicationV2 window
- Custom ancestry editor: display name, male/female name tables, surnames,
  cultural notes for AI context
- World lore text editor with character limit and injection preview
- LLM config management moved into World Config UI
- World config export to downloadable JSON
- World config import from JSON file
- Scene terrain tagging UI (scene config panel integration)
- AI prompt construction updated to include world lore and ancestry
  cultural notes when available

---

## Phase 4 — Regional Encounter System

**What GMs can do:** Define named regions in their world, assign terrain
types and creature biases to each region, tag scenes as belonging to a
region, and have encounter generation automatically use that region's
rules when generating from a tagged scene.

**Work this phase contains:**
- WorldRegion entity and editor in World Config UI
- Terrain type mapping per region (one region maps to multiple terrains)
- Creature bias traits per region (weighted positively in selection)
- Scene-to-region assignment in scene config
- Encounter blueprint picks up active scene's region automatically
- Region lore text injected into AI prompts alongside world lore
- Custom encounter tables per region (optional curated creature pools)

---

## Phase 5 — Quick-Draw Mode, Polish, and Public Launch

**What GMs can do:** Open a minimal one-click encounter or NPC generator
optimized for speed at the table, with no configuration required if party
and scene context is available.

**Work this phase contains:**
- Quick-draw ApplicationV2 window: single button, auto-populates
  everything from Foundry context, fires immediately
- Keyboard shortcut or macro support to open quick-draw directly
- Encounter result sharing to chat (GM-only whisper)
- Generation history: last N encounters and NPCs browsable within
  the session (not persistent between sessions)
- World config polish: bulk name import from text
- Sentry integration replacing Discord webhook
- Module documentation site (GitHub Pages)
- The Forge Creator Program submission and premium listing setup
- FoundryVTT package registry submission
- Accessibility audit on all custom UI elements

---

## Post-Launch Considerations (Not Scoped)

Evaluate after Phase 5 ships based on subscriber feedback.

- Loot generation tied to encounter results
- Encounter difficulty estimator from tokens already on canvas
- NPC relationship tracking within a campaign
- Multi-world config profiles for different campaigns
- Backend server and license key enforcement if piracy becomes
  a meaningful problem
