# PF2e GM Toolkit — Risks and Open Questions

## Risks

### PF2e system schema drift (High probability, Medium impact)
The PF2e system releases multiple updates per month. The data paths
the module depends on — `system.details.level.value`,
`system.attributes.hp.max`, `system.attributes.ac.value`,
`system.traits.value` — can change between releases. Actor creation
for NPC archetypes is particularly sensitive: writing to the wrong
field path creates a broken actor silently.

**Mitigation:** Pin the minimum compatible PF2e version in module.json
compatibility declarations. Add a startup check that validates one known
creature against expected field paths and logs a clear warning if they've
moved. Monitor the PF2e system changelog as part of maintenance routine.

### Actor creation schema complexity (Medium probability, High impact)
Creating a valid PF2e NPC actor programmatically requires knowing the
exact document schema. Missing required fields produce actors that load
with errors or don't display correctly. This is the highest-risk
technical item in Phase 1.

**Mitigation:** Import from compendium rather than constructing from
scratch. Use `pack.getDocument(id)` to get the full archetype actor,
call `Actor.create(archetypeData)` with the compendium data as the base,
then update the created actor's biography and name fields. This delegates
schema correctness to PF2e's own data rather than the module recreating it.

**Action:** Spike this in the first week of Phase 1 before other work
builds on top of it.

### AI JSON parsing unreliability (High probability, Low impact)
LLMs do not reliably produce valid JSON even with explicit instructions.
Different providers behave differently. Currently handled by `JSON.parse()`
after stripping markdown fences; a malformed response silently falls
back to non-AI generation.

**Mitigation:** Add response validation before parse — check that expected
top-level keys exist before trusting the response. Log malformed responses
at warn level for debugging. Use structured output / JSON mode for
providers that support it (OpenAI, Gemini both support this).

### Prompt injection via world lore text (Medium probability, Medium impact)
World lore text is user-controlled input injected directly into AI
prompts. Crafted lore text could manipulate AI behavior or cause
unexpected API spending.

**Mitigation:** Length cap on lore text input (2,000 characters). Strip
control characters and prompt-like patterns before injection. Document
the field's intended use clearly in the UI.

### LLM API key exposure (Low probability, High impact)
API keys stored in Foundry world settings live as plaintext in the
world's database. A GM who shares their world file or has a compromised
Forge account exposes their LLM key.

**Mitigation:** Document this clearly in module settings hint text and
in the module README. Cannot be fully mitigated without a backend proxy,
which contradicts the no-backend constraint. The GM accepts this tradeoff
knowingly when they enter their key.

### Compendium index build time (Low probability, Medium impact)
Building the monster index queries all Actor compendium packs at startup.
With many bestiary modules installed, this could take several seconds
on older hardware.

**Mitigation:** Show a persistent notification during indexing. If build
time exceeds 3 seconds in testing, move indexing to a background task
and show a progress indicator.

### The Forge Creator Program approval timeline (Low probability, Medium impact)
The Forge reviews premium module submissions. Approval is not instant
and may require changes to the module.

**Mitigation:** Submit to The Forge early — when Phase 1 is complete
and stable — even before Phase 5 polish work. Use the approval window
for Phase 5 work. Read The Forge's creator documentation before starting
the submission process.

---

## Open Questions

### Questions the team can answer independently

**What is the minimum Foundry version to declare in module.json?**
Currently targeting v13 build 351. Decision needed on whether to support
earlier v13 builds. Recommendation: declare minimum as 13, verified as
13.351 or latest stable at launch.

**What PF2e system version is the minimum compatible?**
Need to identify the PF2e release where the current data schema was
established and declare that as minimum compatible.

**What archetype categories make sense for the NPC picker?**
Categories need to be defined and the mapping from PF2e trait/source
data to category implemented. Define during Phase 1 NPC work.

**What is the item index scope for shop generation?**
Which item types are included (weapons, armor, consumables, adventuring
gear, magic items) and which are excluded (class features, spells, etc.).
Define during Phase 2 design.

**Should quick-draw have a dedicated keyboard shortcut?**
Foundry supports module-defined keyboard shortcuts. Decide during Phase 5.

### Questions that need external answers

**What are The Forge's revenue share terms for Creator Program?**
Need to know percentage split and payment schedule before setting
subscription pricing. Review The Forge's creator documentation.

**What Patreon tier configuration does The Forge's integration require?**
Need to understand how to configure Patreon tiers so The Forge correctly
identifies subscribers as entitled. Review integration documentation
before Phase 5.

**Does The Forge's premium system support version-gated early access?**
Need to confirm whether The Forge supports delivering pre-release module
versions to specific subscriber tiers, or whether this requires a
separate distribution mechanism.
