# PF2e GM Toolkit

A Foundry VTT module for Pathfinder 2e Game Masters. Generate terrain-aware encounters and richly detailed NPCs directly inside Foundry — tokens placed on your canvas, actors in your world, a live sidebar cockpit for in-session play.

Built for two situations: the GM who wants to plan carefully the night before a session, and the GM who needs a wandering monster encounter or a quick shopkeeper NPC in the next 30 seconds because the party just did something unexpected.

---

## Requirements

- **Foundry VTT** v13 (build 351 or later)
- **Pathfinder 2e** system (any recent version)
- An active subscription — see [Access](#access) below

---

## Features

### Sidebar Cockpit (In-Session Tools)

The GM Toolkit sidebar tab is a live cockpit for active play — no windows to open, everything one click away.

- **Party strip** — shows detected party level and size at all times; edit the fields directly to override auto-detection
- **Terrain selector** — full-width dropdown that sets the canonical terrain for all tools at once; auto-reads from scene metadata on load
- **Session history** — last 5 encounters and NPCs generated this session, compact rows, click to reopen
- **Wandering monster table** — 6 terrain-aware creatures ready before you need them; 🎲 to roll randomly, 📌 to lock a slot across refreshes, click any name to place a hidden token immediately
- **Hazard & trap panel** — browse the PF2e hazard compendium filtered by level and terrain; 🎲 for random, 💬 to whisper the trap description to yourself, 📍 to place a hidden token and open the stat block

### Encounter Builder

- Generates terrain-filtered encounters using PF2e's official XP budget rules
- Reads party level and size directly from connected players — no manual entry needed
- Seven encounter templates (Boss and Lackeys, Mook Squad, Elite Enemies, and more) plus random and custom difficulty modes
- **Boss pinning** — pin any creature as the boss; the system fills the remaining XP budget with creatures that share meaningful traits with the boss; locked boss survives every re-generate
- Places tokens on the active scene hidden from players with one click; optionally adds them to the combat tracker
- Click any creature name to open its compendium stat block

### NPC Generator

- **Purpose selector** — choose the type of NPC before generating (Combat/Guard, Merchant/Trader, Scholar/Sage, Noble/Political, Spiritual/Clergy, Criminal, Commoner/Laborer, or Any); filters the occupation draw and pre-wires the archetype category
- Generates named NPCs with race, sex, occupation, and personality trait
- **Archetype picker** — browse compendium NPCs as the mechanical base, sorted with NPC Gallery entries (purpose-built humanoid archetypes) above bestiary entries; source badge on every entry; dynamic level-to-role guidance
- Creature level defaults to party average; accepts −1 and 0 for commoner-level NPCs
- Creates an actual Foundry Actor in your world — not just a text summary
- **Merchant mode** — when Purpose is set to Merchant/Trader (or manually enabled), generates shop inventory from the equipment compendium filtered by shop type, wealth tier, and location size; actor inventory is populated on creation

### AI Narrative Enhancement (Optional)

Bring your own API key — no subscription to a third-party service required through this module.

Supported providers:
- Google Gemini
- OpenAI (GPT-4o and others)
- Mistral
- Any OpenAI-compatible endpoint (local models via Ollama, Groq, etc.)

When enabled, AI adds vivid setting descriptions, encounter hooks, tactical notes, and battle map setup suggestions to encounters — and fills in appearance, motivation, secrets, and a signature quote for NPCs. Merchants get an AI-generated specialty item with a unique description.

The module works completely without AI configured. AI enhances; it never gates.

### GM Share & Save

- **Share Narrative** button on AI-enhanced results whispers the full content to you in chat
- One click to share a player-safe subset publicly (setting description and hook for encounters; appearance, personality, and quote for NPCs — secrets and tactical notes stay GM-only)
- Encounter and NPC results save to journal entries automatically; NPC journal is created whenever you create an actor, no separate step required
- Hazard descriptions can be whispered to you and optionally shared with players when they detect the trap

### World Context (Coming in Phase 3)

- Define custom ancestries with your own name tables
- Write world lore that gets injected into AI prompts so generated content fits your setting
- Tag scenes with terrain types for automatic encounter filtering

---

## Installation

Install through The Forge marketplace (recommended) or via manifest URL:

```
https://raw.githubusercontent.com/azhreii/pathfinder-gm-toolkit/foundry-module/foundry-module/pf2e-gm-toolkit/module.json
```

Paste the manifest URL into Foundry's **Install Module** dialog → **Install**.

---

## Setup

1. Enable the module in your world's **Module Management**
2. Open **Module Settings → PF2e GM Toolkit** to configure your AI provider (optional)
3. The **GM Toolkit sidebar tab** (🎲 icon) appears in Foundry's right sidebar — visible to GMs only

### AI Configuration

In Module Settings, select your provider and enter your API key. The key is stored in your world data — treat world backups with the same care as the key itself.

If you leave the provider set to Disabled, all generation works without AI — names, stat blocks, and encounter creatures are fully functional.

---

## Usage

### In-Session: Wandering Monsters

1. The sidebar wandering monster table pre-populates from the active scene's terrain automatically
2. Change the **Terrain** dropdown to reload all unlocked slots for the new terrain
3. Click 🎲 to roll a random entry, or just click any creature name to place it as a hidden token
4. 📌 Lock a slot to keep that creature across terrain changes and refreshes

### In-Session: Hazards and Traps

1. The hazard panel shows level-appropriate traps for the current party level
2. Search by name or filter by category (Trap / Environmental / Magical)
3. Click 💬 to whisper the trap's description, trigger, and disable DC to yourself
4. Click 📍 to place a hidden token on the scene and open the stat block simultaneously

### Planning: Building an Encounter

1. Click **Build Encounter** in the sidebar
2. Party level and size are auto-detected — edit in the sidebar or the encounter form
3. Select terrain, generation mode, and click **Generate Encounter**
4. Optionally pin a creature as boss — the table re-fills with trait-matched supporters
5. Click **Place Tokens** — tokens appear hidden on the canvas, positioned in a spiral

### Planning: Generating an NPC

1. Click **Create NPC** in the sidebar
2. Choose a **Purpose** (e.g., Merchant/Trader for a shopkeeper) — this pre-filters occupations and the archetype picker
3. Set creature level and click **Generate NPC**
4. Browse **Archetypes** to choose a compendium NPC as the mechanical base (NPC Gallery entries appear first)
5. For merchants: adjust shop type, wealth tier, and location size; inventory is populated automatically
6. Click **Create Actor** — the actor opens for review, and a journal entry is saved automatically

---

## Access

This module requires an active subscription to use.

**The Forge** — install and subscribe directly through The Forge marketplace. Your Patreon membership (if linked) grants access automatically.

**Patreon** — subscribers receive access via a patron-only post. [Patreon link coming soon]

See [LICENSE](LICENSE) for the full terms. Source code is made available for review; use requires an active subscription.

---

## Roadmap

| Phase | Status | What's in it |
|-------|--------|--------------|
| Phase 0 — Walking skeleton | ✅ Complete | Basic generation, compendium indexing, journal persistence |
| Phase 1 — Foundry integration | ✅ Complete | Tokens, actors, party detection, multi-LLM, dynamic model picker, dedicated sidebar tab |
| Phase 2 — NPC depth + shops + sidebar | ✅ Complete | Boss pinning, archetype picker improvements, NPC Purpose selector, merchant inventory, in-session sidebar cockpit, AI share/save infrastructure |
| Phase 3 — World config | Planned | Custom ancestries, world lore, AI context injection |
| Phase 4 — Regional system | Planned | Named regions, scene-to-region mapping |
| Phase 5 — Polish + launch | Planned | Keyboard shortcuts, esbuild bundle, Sentry, Forge listing |

---

## Contributing

Bug reports and pull requests are welcome. By submitting a contribution you agree that it will be governed by the [LICENSE](LICENSE) terms.

For significant changes, open an issue first to discuss the approach.

---

## License

Proprietary — see [LICENSE](LICENSE) for full terms.
Copyright (c) 2025-2026 Tod Moses II. All rights reserved.
