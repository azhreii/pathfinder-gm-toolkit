# Changelog

All notable changes to PF2e GM Toolkit are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.4] — 2026-06-04

### Fixed
- **Token images missing for module monsters** — switched token actor import from `actorDoc.toObject()` + `Actor.create()` to `game.actors.importFromCompendium()`. The previous path bypassed Foundry's internal `fromCompendium()` transformation, which is responsible for resolving module-relative artwork paths. Tokens placed from third-party bestiary modules now show their correct images.
- **"Add to Combat" creates encounter that isn't visible** — added `combat.activate()` after creating a new combat encounter so it becomes the active encounter in the combat tracker. Previously the encounter was created silently and the GM had to manually click it in the encounters list.
- **Deprecated `renderChatMessage` hook** — changed to `renderChatMessageHTML` (Foundry v13 requirement; backwards-compatible support ends in v15). The Share/Save buttons in GM whisper messages continue to work correctly.
- **AI encounter narrative JSON truncation** — increased Gemini `maxOutputTokens` from 2048 to 4096 and added `responseMimeType: "application/json"` to force JSON-mode output. Eliminates the "Unterminated string" parse errors that caused AI narrative generation to silently fail.

### Changed
- **Sidebar redesigned — party/terrain at top** — the party level, party size, and terrain selector are now the first controls in the sidebar (above all tool sections), making it clear they govern everything below.
- **All sidebar sections are now collapsible** — each section (Wandering Monsters, Hazards & Traps, Session History, Build Encounter, Create NPC) has a ▼/▶ caret that collapses or expands it. State is preserved across re-renders within the same session.
- **Build Encounter and Create NPC are now sidebar sections** — instead of plain launch buttons, each tool has a dedicated collapsible panel. When expanded, the panel shows the most recent result from session history (with a quick re-open link) and a button to open the full builder/generator.

---

## [0.3.3] — 2026-06-04

### Fixed
- **Chat message validation error** — removed `type: "whisper"` from `ChatMessage.create()` in
  `gm-share.js`. In Foundry v12+, whisper messages are defined by the `whisper` recipient array
  only; passing a `type` field causes a `DataModelValidationError` in PF2e's `ChatMessagePF2e`
  subclass. The 💬 Describe Hazard button and Share Narrative buttons now work correctly.

---

## [0.3.2] — 2026-06-04

### Fixed
- **Token artwork missing** — replaced deprecated `game.actors.fromCompendium()` with
  `actorDoc.toObject()` in the token placement pipeline. `fromCompendium()` does not correctly
  resolve token artwork paths in Foundry v13, causing tokens to appear without images.
- **Sidebar dropdowns closing immediately** — removed `data-action` from all `<select>` and
  `<input>` elements in the sidebar template. ApplicationV2's `data-action` handler fires on
  `click`, which triggered a re-render the moment the user clicked to open a dropdown, destroying
  the DOM before a value could be chosen. All sidebar interactive elements now use native
  `change`/`input` listeners wired in `_onRender()`.
- **NPC journal not auto-saved** — `saveNPCToJournal()` is now called automatically when
  `Create Actor` succeeds, so a journal record is always created without a separate step.

### Changed
- **Sidebar layout** — Build Encounter and Create NPC buttons moved to the top of the sidebar
- **Terrain selector** — full-width with a prominent label; previously too narrow to read easily
- **Party info** — replaced static text with editable level and size inputs; manual edits override
  auto-detection and immediately re-generate the wandering monster table; a green dot (●) indicates
  the value is coming from auto-detection

---

## [0.3.1] — 2026-06-04

### Added
- **NPC Purpose selector** — new dropdown at the top of the NPC Generator form with eight options:
  Any, Combat/Guard, Merchant/Trader, Noble/Political, Scholar/Sage, Spiritual/Clergy, Criminal,
  Commoner/Laborer. Selecting a purpose filters the occupation pool to contextually appropriate
  options, pre-sets the archetype category filter, and automatically enables merchant mode when
  Merchant/Trader is chosen. Purpose stays selected across Clears for batch generation.
- Occupation list expanded from 20 to 50 entries to support per-purpose pools.

---

## [0.3.0] — 2026-06-02

### Added
- **Boss pinning** (encounter builder) — pin any creature from a generated encounter as the boss.
  The boss's XP is locked in the budget; re-generating fills only the supporter slots with
  creatures sharing meaningful traits (generic traits like `humanoid`/`medium` are excluded).
  Visual: gold row highlight, crown badge, pin/unpin button per row, "Boss locked" banner.
- **NPC archetype picker improvements** — source badge on every entry (amber pill for NPC Gallery,
  muted label for Bestiary); NPC Gallery entries sorted to top within each category; dynamic
  level-to-role guidance line below the level input; level input now accepts −1 for commoner NPCs.
- **AI Share/Save infrastructure** (`gm-share.js`) — `GMTOOLKIT.shareContent()` routes
  AI-generated text through a consistent two-step flow: whisper full content to GM, then offer
  a "Share with players" button that posts a filtered public message (flavor only; secrets and
  tactical notes stay GM-only). Encounter journals include the full creature table and all AI
  narrative sections — enough to rerun the same encounter with a different group. NPC AI flavor
  is written to actor biography on creation.
- **Item compendium index** — 7 categories (weapon, armor, consumable, alchemical, magical,
  adventuring, treasure), level-filtered, skips unique items. Foundation for the shop system.
- **Hazard compendium index** — PF2e hazards indexed by level, terrain traits (10 terrains),
  and category (trap / environmental / magical). Hazards without a terrain match are tagged
  `any` so they surface everywhere.
- **Sidebar cockpit** — `toolkit-sidebar-tab.js` overhauled into a live in-session cockpit:
  - Canonical terrain state: `GMTOOLKIT._currentTerrain` owned by the sidebar, read by all tools
  - Session history: last 5 encounters/NPCs, compact clickable rows
  - Wandering monster table: 6 terrain-aware entries, lockable per slot, 🎲 to roll, ↺ to refresh,
    click any name to place a hidden token immediately
  - Hazard panel: search + category filter, random select, place token + open sheet, whisper
    description to GM
- **Shop system** (`shop-logic.js`) — merchant mode on NPC generator: infer shop type from
  occupation (7 types, 17 keyword groups), or set manually. Wealth tier and location size control
  item level band and inventory count. Weighted category draw fills inventory from the item index.
  Actor inventory is populated via `createEmbeddedDocuments` on creation. Optional AI specialty
  item with a unique description and price.
- **Phase 1 polish** — all `getGeminiKey()` calls retired; `isAIEnabled()` used consistently.
  30-second `AbortController` timeout on all LLM `fetch` calls with distinct timeout log message.

---

## [0.2.4] — 2026-06-02

### Fixed
- Resolved `sourceId` deprecation warnings flooding the console on world load
- Corrected token artwork resolution for placed encounter tokens
- Fixed combat tracker encounter creation using `getDocumentClass("Combat")` to get PF2e's
  `EncounterPF2e` subclass
- Fixed AI response truncation causing JSON parse errors on longer responses (raised
  `maxOutputTokens` to 2048)

---

## [0.2.3] — 2026-06-02

### Added
- Dynamic model picker in AI settings — fetches the live model list from the configured provider
  when the API key is entered; provider-specific filtering (GPT/O-series for OpenAI,
  `generateContent`-capable for Gemini, non-embedding for Mistral)

---

## [0.2.0] — 2026-06-02

### Added
- Dedicated GM-only sidebar tab (🎲 icon) replacing the Journal button injection approach
- Multi-LLM support: OpenAI, Gemini, Mistral, and any OpenAI-compatible endpoint (Ollama, Groq, etc.)
- NPC archetype picker — humanoid-trait-filtered compendium index, category-grouped, level-filtered
  ±1 from the selected creature level
- NPC creature level selection with party-average default and manual override
- NPC actor creation from archetype compendium base with flavor overlaid
- Input sanitization and lore text length cap (2 000 characters)
- Gemini model updated to `gemini-2.5-flash`

### Fixed
- Party detection now reads `game.actors.party` first; falls back to active connected users
- Terrain dropdown always shown; auto-populates from active scene flag when available

---

## [0.1.x] — Earlier

### Added
- Phase 0 walking skeleton: encounter generation with XP budget math and terrain filtering
- Compendium-based monster indexing (no bundled JSON — uses whatever bestiary packs are installed)
- NPC flavor generation with optional Gemini AI enhancement
- Journal entry persistence for encounters and NPCs
- Token placement for encounters with spiral positioning and hidden-from-players default
- Combat tracker integration
- Compendium sheet linking from encounter creature entries
- GitHub Actions release automation (version tag → ZIP → GitHub Release)
