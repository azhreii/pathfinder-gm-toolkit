"""Shared constant data for the Pathfinder GM Toolkit.

This file is intentionally simple: it holds the lists that power menus and
basic random generation. Keeping static data in one place makes the rest of
the code easier to read, test, and eventually reuse in a GUI.
"""

# Default SQLite database filename used by the storage layer.
# Centralizing this here keeps every module that touches persistence in sync.
DB_FILE = "gm_toolkit.db"

# Available terrain types. These keys must match terrain_mapping.json.
TERRAIN_TYPES = [
    "forest",
    "urban",
    "underground",
    "aquatic",
    "coastal",
    "mountains",
    "desert",
    "arctic",
    "planar_air",
    "planar_earth",
    "planar_fire",
    "planar_water",
    "graveyard",
    "astral",
    "ethereal",
    "hell",
    "abyss",
    "heaven",
    "shadow",
    "first_world",
    "any",
]

# Simple fallback occupations used when AI is disabled or unavailable.
OCCUPATIONS = [
    "Blacksmith",
    "Merchant",
    "Guard",
    "Innkeeper",
    "Farmer",
    "Bard",
    "Alchemist",
    "Healer",
    "Thief",
    "Noble",
    "Sailor",
    "Hunter",
    "Priest",
    "Scholar",
    "Carpenter",
    "Tailor",
    "Fisherman",
    "Miner",
    "Cook",
    "Apothecary",
]

# Simple fallback personality hooks for non-AI NPC generation.
PERSONALITY_TRAITS = [
    "Brave",
    "Cautious",
    "Curious",
    "Friendly",
    "Grumpy",
    "Honest",
    "Loyal",
    "Mysterious",
    "Optimistic",
    "Pessimistic",
    "Reckless",
    "Shy",
    "Skeptical",
    "Trusting",
    "Witty",
    "Suspicious of outsiders",
    "Overly cheerful",
    "Speaks in riddles",
    "Has a nervous tic",
    "Always hungry",
    "Obsessed with cleanliness",
    "Tells bad jokes",
    "Unnaturally calm",
    "Rude",
    "Sarcastic",
]
