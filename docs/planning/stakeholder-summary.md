# PF2e GM Toolkit — Summary

## What This Is

A paid Foundry VTT module for Pathfinder 2e GMs. Two core tools:
an encounter builder that places tokens directly on the canvas, and
an NPC generator that creates real Foundry actors with proper PF2e
stat bases. Optional AI enhancement using the GM's own API key.
Optional homebrew layer for GMs with custom worlds.

Built for two situations: the GM who wants to plan carefully the night
before a session, and the GM who needs a wandering monster encounter
or a quick shopkeeper in the next 60 seconds because the party just
did something unexpected.

## What We Understood You Were Asking For

A port of an existing Python CLI tool into a Foundry module, distributed
on Patreon and The Forge.

## What We're Actually Building

That, plus the gap between "CLI logic running in a browser" and "a tool
that uses Foundry as its actual platform." The difference is that
generating a creature list and making the GM manually find and drag
every token onto the map is not a Foundry tool — it's a search assistant.
A Foundry tool places the tokens. It creates the actor. It opens the
stat block when you click the name. That is the standard this plan holds
the module to.

## Distribution and Revenue

Primary: The Forge Creator Program with Patreon integration. Subscribers
link their Patreon account to The Forge; access is automatic. The Forge
handles payment, entitlement, and delivery. No backend server required.

Secondary: Patreon-only download post for self-hosted Foundry users.
Honor system. Standard practice for this creator market.

The module contains no license checking code. Entitlement lives entirely
in The Forge's platform.

## Phase 1 Is the First Subscriber-Worthy Release

Phase 0 exists but is not ready to charge for. Phase 1 is MVP:
token placement, actor creation, compendium linking, party auto-detection,
multi-LLM support, and the CI/CD pipeline that makes releasing updates
sustainable. That is what justifies a paid tier.

Before Phase 1 goes public on The Forge: Sentry error tracking must
replace the Discord webhook used during development. This is a hard gate.

## What We're Deferring and Why

**Shop inventory (Phase 2):** NPC actors created in Phase 1 will have
empty inventories for merchant types. The item index needed to populate
shops is substantial work. Core actor creation ships first.

**World Config UI (Phase 3):** AI enhancement works in Phase 1 using
generic PF2e flavor. Custom ancestry names and world lore injection
require a config editor that doesn't exist yet. Phase 3 builds it.

**Quick-draw mode (Phase 5):** The workshop form works at the table.
It is not as fast as a dedicated one-click surface but it functions.
Quick-draw is polish, not capability.

**Claude API support:** Anthropic does not allow browser-side API calls
due to CORS policy. Not on the roadmap without a backend server.

## What We Need Before Phase 1 Begin

1. **The Forge Creator Program documentation reviewed** — specifically
   Patreon tier configuration requirements and revenue share terms.
   These affect pricing decisions before any subscriber-facing work ships.

2. **NPC actor creation spiked in week one** — confirm that importing a
   compendium creature and modifying its name and biography fields produces
   a valid, usable actor. This is the highest-risk technical item and
   other Phase 1 work builds on top of it.

3. **esbuild pipeline and GitHub Actions running first** — infrastructure
   that everything else depends on. Build it before feature work begins.

## First Milestone

Phase 1 complete: a GM installs the module, opens the encounter builder,
sees their party's level and size already filled in, selects a terrain,
hits generate, and tokens appear on their canvas — hidden from players,
ready to be placed. That experience, working reliably, is the first
milestone worth charging for.
