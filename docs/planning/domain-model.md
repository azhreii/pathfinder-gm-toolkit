# PF2e GM Toolkit — Domain Model

## Core Entities

### EncounterBlueprint
The inputs to encounter generation. Two forms share one underlying
structure: a quick form (auto-populated from Foundry context, minimal
overrides) and a workshop form (full manual control).

Fields:
- partyLevel — derived from active player characters, overridable
- partySize — derived from active player character count, overridable
- terrain — always manually selectable; auto-suggested from scene
  metadata when available, otherwise no default
- generationMode — random | template | custom
- templateKey — used when mode is template
- difficulty — used when mode is custom
- pinnedCreature — optional compendium reference locked as the boss slot
- sceneRef — the target scene for token placement; defaults to active scene
- monsterSourceFilter — which compendium packs to draw creatures from
- placementMode — scatter | manual
- addToCombat — boolean, default false
- useAI — boolean, requires configured LLM provider

### EncounterResult
The output of a generation run. Derived from a blueprint; never edited
directly.

Fields:
- blueprint snapshot (copy of inputs that produced this result)
- creatures — array of EncounterCreature
- templateName — display name of the template or mode used
- difficulty — resolved difficulty label
- xpBudget — calculated target
- actualXP — sum of selected creatures' XP values
- aiNarrative — optional object from LLM (setting, hook, tactical notes,
  battle map details)

### EncounterCreature
One creature slot in an EncounterResult. May represent multiple identical
creatures (count > 1).

Fields:
- packId — Foundry compendium collection ID
- actorId — entry ID within that pack
- name, level, hp, ac, traits — cached from index at generation time
- role — Boss | Lieutenant | Soldier | Lackey | Elite | Mook | Enemy
- count
- xpEach — calculated from level vs. party level at generation time

### PlacedEncounter
An EncounterResult that has been placed on a scene.

Fields:
- encounterResult reference
- sceneId
- tokenIds — array of created token document IDs
- hidden — boolean, default true
- addedToCombat — boolean

### NPCProfile
The generated flavor layer of an NPC. Always produced first; archetype
and shop are optional additions.

Fields:
- name, race, sex
- occupation, personality
- appearance, motivation, secret, quote — null for basic (non-AI) generation
- aiEnhanced — boolean

### NPCArchetype
A compendium creature used as the mechanical base for an NPC Actor.
Optional. Provides real PF2e stat block (HP, AC, saves, attacks).

Fields:
- packId, actorId
- displayName — shown in the archetype picker UI
- category — broad grouping for filtering (Combatant, Spellcaster,
  Non-combatant, Specialist, etc.)
- level — creature level, used to filter picker to appropriate options

### ShopConfig
Configuration for merchant NPC inventory generation. Only relevant when
NPCProfile occupation is a merchant type.

Fields:
- shopType — inferred from occupation, GM-adjustable
  (General Goods | Weapons & Armor | Alchemical | Magic Items |
   Provisions | Specialty)
- wealthTier — Poor | Standard | Wealthy | Exceptional
- locationSize — Village | Town | City | Metropolis
- itemLevelCap — calculated from creature level and location size;
  overridable
- itemCount — calculated from wealth tier and location size; overridable

### GeneratedActor
A Foundry Actor document created by the module. The Actor itself is
owned by Foundry; this entity tracks the back-reference.

Fields:
- foundryActorId
- sourceProfile — NPCProfile that generated it
- sourceArchetype — NPCArchetype used as mechanical base (nullable)
- sourceShopConfig — ShopConfig used to populate inventory (nullable)
- createdAt

### WorldConfig
The homebrew world context. Stored as world-level module flags on the
Foundry World document. One per world.

Fields:
- worldName
- loreText — freeform text injected into AI prompts as world context
- customAncestries — array of CustomAncestry
- llmConfig — embedded LLMConfig

### CustomAncestry
A homebrew race/ancestry with its own name tables.

Fields:
- key — internal identifier
- displayName
- maleNames[], femaleNames[], surnames[]
- culturalNotes — short text injected into AI prompts when this ancestry
  is selected (influences appearance, personality, occupation suggestions)

### WorldRegion (Phase 4)
A named location in the homebrew world. Maps terrain types and can bias
creature selection.

Fields:
- name
- terrainTypes[] — one or more of the standard terrain type keys
- creatureBiasTraits[] — traits to weight positively in creature selection
- loreText — injected into AI prompts when region is active
- sceneIds[] — Foundry scenes tagged as belonging to this region

### LLMConfig
LLM provider configuration. Embedded in WorldConfig.

Fields:
- provider — openai | gemini | mistral | openai-compatible
- model — string (e.g., "gpt-4o", "gemini-2.0-flash")
- apiKey — stored in Foundry world settings, GM-restricted
- baseUrl — used for openai-compatible providers (custom endpoint)
- enabled — boolean; if false, all AI features are silently skipped

## Key Relationships

- EncounterBlueprint → EncounterResult: one blueprint produces one result
  per generation run; previous results are not retained between sessions
- EncounterResult → EncounterCreature: one to many
- EncounterResult → PlacedEncounter: one to zero or one
- EncounterCreature → Foundry Compendium Entry: reference (not a copy)
- NPCProfile + NPCArchetype → GeneratedActor: combined at creation time
- ShopConfig → GeneratedActor inventory: applied at creation time
- WorldConfig → CustomAncestry: one to many
- WorldConfig → LLMConfig: embedded one to one
- WorldRegion → WorldConfig: many to one (Phase 4)
- WorldRegion → terrain types: many to many (Phase 4)

## Key Lifecycle States

**Encounter:**
Blueprint defined → Result generated → [AI narrative applied] →
[Placed on canvas] → [Added to combat tracker]

**NPC:**
Profile generated → [Archetype selected] → [Shop configured] →
Actor created in world

**WorldConfig:**
Created (empty) → Ancestries added → Lore text written → LLM configured
→ [Regions defined - Phase 4]

## What This System Does Not Track

- Individual monster stat blocks — those live in Foundry's compendiums
- Combat outcomes — Foundry's combat tracker owns that
- Session history — past encounters and NPCs become Foundry journal entries
  and actors; the module doesn't maintain its own history log
- Player characters — the module reads party data but never writes to
  player character sheets
