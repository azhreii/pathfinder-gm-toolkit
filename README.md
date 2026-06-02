# PF2e GM Toolkit

A Foundry VTT module for Pathfinder 2e Game Masters. Generate terrain-aware encounters and richly detailed NPCs directly inside Foundry — tokens placed on your canvas, actors created in your world, stat blocks one click away.

Built for two situations: the GM who wants to plan carefully the night before a session, and the GM who needs a wandering monster encounter or a quick shopkeeper NPC in the next 30 seconds because the party just did something unexpected.

---

## Requirements

- **Foundry VTT** v13 (build 351 or later)
- **Pathfinder 2e** system (any recent version)
- An active subscription — see [Access](#access) below

---

## Features

### Encounter Builder

- Generates terrain-filtered encounters using PF2e's official XP budget rules
- Reads party level and size directly from your connected players — no manual entry needed
- Terrain pre-selects from scene metadata when available; always manually adjustable
- Seven encounter templates (Boss and Lackeys, Mook Squad, Elite Enemies, and more) plus random and custom difficulty modes
- Places tokens on the active scene hidden from players with one click
- Optionally adds tokens directly to the combat tracker
- Click any creature name to open its compendium stat block

### NPC Generator

- Generates named NPCs with race, occupation, personality, and flavor details
- Archetype picker lets you choose a compendium NPC as the mechanical base — your generated character gets a real PF2e stat block
- Creates an actual Foundry Actor in your world, not just a text summary
- Creature level defaults to your party's average level with manual override

### AI Narrative Enhancement (Optional)

Bring your own API key — no subscription to a third-party service required through this module.

Supported providers:
- Google Gemini
- OpenAI (GPT-4o and others)
- Mistral
- Any OpenAI-compatible endpoint (local models via Ollama, Groq, etc.)

When enabled, AI adds vivid setting descriptions, encounter hooks, tactical notes, and battle map setup suggestions to encounters — and fills in appearance, motivation, secrets, and a signature quote for NPCs.

The module works completely without AI configured. AI enhances; it never gates.

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
3. The **Encounters** and **NPCs** buttons appear at the top of your Journal sidebar (GM only)

### AI Configuration

In Module Settings, select your provider and enter your API key. The key is stored in your world data — treat world backups with the same care as the key itself.

If you leave the provider set to Disabled, all generation works without AI — names, stat blocks, and encounter creatures are fully functional.

---

## Usage

### Generating an Encounter

1. Open a scene with your players connected
2. Click **Encounters** in the Journal sidebar
3. Party level and size are auto-detected — adjust if needed
4. Select terrain, generation mode, and hit **Generate Encounter**
5. Review the creature list, then click **Place Tokens** — tokens appear on the canvas, hidden from players

### Generating an NPC

1. Click **NPCs** in the Journal sidebar
2. Hit **Generate NPC**
3. Optionally browse the **Archetype** picker to give the NPC a real stat block base
4. Click **Create Actor** — the actor appears in your world and opens for review

---

## Access

This module requires an active subscription to use.

**The Forge** — install and subscribe directly through The Forge marketplace. Your Patreon membership (if linked) grants access automatically.

**Patreon** — subscribers receive access via a patron-only post. [Patreon link coming soon]

See [LICENSE](LICENSE) for the full terms. Source code is made available for review; use requires an active subscription.

---

## Roadmap

| Phase | Status | What's coming |
|-------|--------|---------------|
| Phase 0 — Walking skeleton | ✅ Complete | Basic generation, compendium indexing |
| Phase 1 — Foundry integration | ✅ Complete | Tokens, actors, party detection, multi-LLM |
| Phase 2 — NPC depth + shops | 🔜 Next | Boss pinning, merchant inventory generation |
| Phase 3 — World config | Planned | Custom ancestries, world lore, AI context |
| Phase 4 — Regional system | Planned | Named regions, scene-to-region mapping |
| Phase 5 — Quick-draw + launch | Planned | One-click in-session mode, Forge listing |

---

## Contributing

Bug reports and pull requests are welcome. By submitting a contribution you agree that it will be governed by the [LICENSE](LICENSE) terms.

For significant changes, open an issue first to discuss the approach.

---

## License

Proprietary — see [LICENSE](LICENSE) for full terms.
Copyright (c) 2025-2026 Tod Moses II. All rights reserved.
