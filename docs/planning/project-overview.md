# PF2e GM Toolkit — Project Overview

## What This Is

A Foundry VTT module for Pathfinder 2e that gives GMs two core tools:
an encounter builder and an NPC generator. Both tools are designed to
work in two modes — pre-session prep and live in-session improvisation —
with an optional homebrew world layer that lets GMs inject their own
lore, races, and regional rules into generation.

The module reads creature data directly from whatever PF2e compendium
packs the GM has installed. It writes output back into Foundry's own
systems — actors, tokens on the canvas, journal entries — rather than
producing text the GM has to manually act on.

AI narrative enhancement is optional. GMs bring their own API key.
The module works fully without it.

## Stated Goal vs. Implied Goal

The stated goal was to port an existing Python CLI tool into a Foundry
module. The implied goal — which emerged during planning — is to build
a distributable paid product that feels genuinely native to Foundry
rather than a browser skin over a command-line tool. Those are different
quality bars. This plan targets the implied goal.

## Users

Primary user: the GM. Single-user tool — players never interact with it.

Two usage contexts with different needs:

**Prep mode** — used the night before a session. The GM has time,
wants control, may want AI-enhanced narrative, will configure a full
encounter or NPC deliberately. Richer UI, more options, save to journal
for reference later.

**In-session mode** — used at the table when the party does something
unexpected. Needs to be fast. Party wanders off the planned path, GM
needs a wandering monster encounter or a quick shopkeeper NPC in under
30 seconds. Minimal clicks, immediate output, tokens on the map.

## System Boundaries

The module owns: generation logic, UI, world config storage, output
creation (actors, tokens, journal entries).

Foundry owns: the compendium data the module reads from, the actor and
token documents the module creates, the world database where config
is stored.

The LLM provider owns: AI generation. The module constructs prompts and
parses responses. The provider's API is an external dependency the module
treats as optional and unreliable.

The Forge owns: entitlement checking, delivery to subscribers, Patreon
integration.

## Success Criteria

- A GM can generate a terrain-appropriate, XP-budget-correct encounter
  and have tokens on their canvas in under 60 seconds from opening the
  tool, without touching anything outside the module window.
- A GM can generate a named NPC with personality, a mechanical stat base,
  and a populated shop inventory and have a usable Foundry Actor in their
  world in under 90 seconds.
- A GM with a homebrew world can configure their custom ancestries and
  world lore once and have it automatically inform AI output on every
  subsequent generation without additional input.
- The tool works completely without an AI API key. AI enhances; it does
  not gate.

## Distribution

Primary: The Forge Creator Program with Patreon tier integration.
Subscribers link their Patreon account to The Forge; entitlement is
handled automatically by The Forge's platform.

Secondary: Patreon-only post with direct download link for self-hosted
Foundry users. Honor system. Known gap, accepted at this scale.

GitHub releases serve as the canonical version history and distribution
source for The Forge's package delivery.
