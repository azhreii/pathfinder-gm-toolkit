"""Encounter-building rules and helper functions.

The functions in this module focus on PF2e encounter logic. They are written
as plain functions so they can be called by a CLI today, a GUI next, and a
Foundry module later.
"""

import random
from collections import Counter, defaultdict


def format_terrain_name(terrain):
    """Convert internal keys like 'planar_fire' into display text."""
    return " ".join(part.capitalize() for part in terrain.split("_"))


def monster_matches_terrain(monster, terrain, terrain_mapping):
    """Return True if a monster fits the requested terrain rules."""
    terrain_definitions = terrain_mapping.get("terrain_definitions", {})
    if terrain not in terrain_definitions:
        return False

    terrain_data = terrain_definitions[terrain]
    monster_traits = set(monster.get("traits", []))

    exclude_traits = set(terrain_data.get("exclude_traits", []))
    if monster_traits & exclude_traits:
        return False

    creature_types = set(terrain_data.get("creature_types", []))
    if monster_traits & creature_types:
        return True

    special_traits = set(terrain_data.get("special_traits", []))
    if monster_traits & special_traits:
        return True

    specific_ancestries = set(terrain_data.get("specific_ancestries", []))
    if monster_traits & specific_ancestries:
        return True

    return False


def get_creature_xp(creature_level, party_level):
    """Map level difference to PF2e encounter XP."""
    level_diff = creature_level - party_level
    xp_by_difference = {
        -4: 10,
        -3: 15,
        -2: 20,
        -1: 30,
        0: 40,
        1: 60,
        2: 80,
        3: 120,
        4: 160,
    }

    if level_diff < -4:
        return 10
    if level_diff > 4:
        return 160
    return xp_by_difference.get(level_diff, 40)


def calculate_xp_budget(party_size, difficulty):
    """Calculate the target encounter budget for a party size and difficulty."""
    base_budgets = {
        "trivial": 40,
        "low": 60,
        "moderate": 80,
        "severe": 120,
        "extreme": 160,
    }
    char_adjustments = {
        "trivial": 10,
        "low": 20,
        "moderate": 20,
        "severe": 30,
        "extreme": 40,
    }

    base_xp = base_budgets.get(difficulty, 80)
    adjustment_per_char = char_adjustments.get(difficulty, 20)
    return base_xp + ((party_size - 4) * adjustment_per_char)


def get_encounter_templates():
    """Return the quick encounter templates used by the toolkit."""
    return {
        "boss_and_lackeys": {
            "name": "Boss and Lackeys",
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 1, "level_mod": 2, "role": "Boss"},
                {"count": 4, "level_mod": -4, "role": "Lackey"},
            ],
        },
        "boss_and_lieutenant": {
            "name": "Boss and Lieutenant",
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 1, "level_mod": 2, "role": "Boss"},
                {"count": 1, "level_mod": 0, "role": "Lieutenant"},
            ],
        },
        "elite_enemies": {
            "name": "Elite Enemies",
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 3, "level_mod": 0, "role": "Elite"},
            ],
        },
        "lieutenant_and_lackeys": {
            "name": "Lieutenant and Lackeys",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 1, "level_mod": 0, "role": "Lieutenant"},
                {"count": 4, "level_mod": -4, "role": "Lackey"},
            ],
        },
        "mated_pair": {
            "name": "Mated Pair",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 2, "level_mod": 0, "role": "Standard"},
            ],
        },
        "troop": {
            "name": "Troop",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 1, "level_mod": 0, "role": "Leader"},
                {"count": 2, "level_mod": -2, "role": "Soldier"},
            ],
        },
        "mook_squad": {
            "name": "Mook Squad",
            "xp": 60,
            "difficulty": "low",
            "structure": [
                {"count": 6, "level_mod": -4, "role": "Mook"},
            ],
        },
    }


def _build_narrative_block(ai_narrative):
    """Format AI narrative text as a reusable display block."""
    if not ai_narrative:
        return ""

    return f"""
{'=' * 50}
NARRATIVE ENHANCEMENT
{'=' * 50}

Setting:
{ai_narrative.get('setting_description', 'N/A')}

The Encounter:
{ai_narrative.get('monster_description', 'N/A')}

Hook/Context:
{ai_narrative.get('encounter_hook', 'N/A')}

Tactical Notes:
{ai_narrative.get('tactical_notes', 'N/A')}

Battle Map Setup:
{ai_narrative.get('battle_map_details', 'N/A')}
"""


def _build_encounter_data(template_type, difficulty, party_level, party_size, terrain, xp_budget, monsters_for_ai, ai_narrative):
    """Build the structured encounter record used for saving results."""
    ai_narrative = ai_narrative or {}
    return {
        "template_type": template_type,
        "difficulty": difficulty,
        "party_level": party_level,
        "party_size": party_size,
        "terrain": terrain,
        "xp_budget": xp_budget,
        "monsters": monsters_for_ai,
        "setting_description": ai_narrative.get("setting_description", ""),
        "monster_description": ai_narrative.get("monster_description", ""),
        "encounter_hook": ai_narrative.get("encounter_hook", ""),
        "tactical_notes": ai_narrative.get("tactical_notes", ""),
        "battle_map_details": ai_narrative.get("battle_map_details", ""),
    }


def generate_encounter_from_template(
    template_key,
    party_level,
    party_size,
    terrain,
    monster_index,
    terrain_mapping,
    ai_callback=None,
):
    """Build an encounter from one of the predefined templates.

    The optional ai_callback lets callers inject AI enrichment without hard
    wiring this rules module to one specific AI provider.
    """
    templates = get_encounter_templates()
    if template_key not in templates:
        return "Invalid template selected.", None

    template = templates[template_key]
    # Adjust the template's XP budget for the actual party size so saved
    # encounters reflect the real budget, not the raw 4-character baseline.
    adjusted_xp_budget = calculate_xp_budget(party_size, template["difficulty"])
    terrain_monsters = [
        monster for monster in monster_index if monster_matches_terrain(monster, terrain, terrain_mapping)
    ]
    if not terrain_monsters:
        return f"No monsters found for terrain: {terrain}", None

    encounter_creatures = []
    for group in template["structure"]:
        target_level = party_level + group["level_mod"]
        level_matches = [monster for monster in terrain_monsters if monster["level"] == target_level]
        if not level_matches:
            level_matches = [
                monster for monster in terrain_monsters if abs(monster["level"] - target_level) <= 1
            ]
        if not level_matches:
            return f"Cannot build {template['name']} - no monsters found at level {target_level} for {terrain}", None

        for _ in range(group["count"]):
            encounter_creatures.append(
                {
                    "monster": random.choice(level_matches),
                    "role": group["role"],
                }
            )

    output = f"""
Encounter Generated: {template['name']}
{'=' * 50}
Party Level: {party_level} (Party Size: {party_size})
Difficulty: {template['difficulty'].capitalize()}
XP Budget: {adjusted_xp_budget} XP (party-adjusted from {template['xp']} base)
Terrain: {format_terrain_name(terrain)}

Creatures:
{'-' * 50}
"""

    role_groups = defaultdict(list)
    for entry in encounter_creatures:
        role_groups[(entry["role"], entry["monster"]["name"])].append(entry["monster"])

    for (role, name), monsters in role_groups.items():
        count = len(monsters)
        monster = monsters[0]
        xp = get_creature_xp(monster["level"], party_level)
        if count > 1:
            output += f"\n{count}x {name} ({role})"
        else:
            output += f"\n{name} ({role})"
        output += f"\n  Level {monster['level']} | HP {monster['hp']} | AC {monster['ac']} | {xp} XP each"
        if monster.get("remaster"):
            output += " [Remaster]"
        output += "\n"

    monsters_for_ai = [{"name": entry["monster"]["name"], "level": entry["monster"]["level"]} for entry in encounter_creatures]
    ai_narrative = ai_callback(output, terrain, template["name"], monsters_for_ai) if ai_callback else None
    output += _build_narrative_block(ai_narrative)

    encounter_data = _build_encounter_data(
        template["name"],
        template["difficulty"],
        party_level,
        party_size,
        terrain,
        adjusted_xp_budget,
        monsters_for_ai,
        ai_narrative,
    )
    return output, encounter_data


def generate_random_encounter(party_level, party_size, terrain, monster_index, terrain_mapping, ai_callback=None):
    """Pick a weighted template and generate an encounter from it."""
    template_weights = {
        "mook_squad": 3,
        "mated_pair": 3,
        "troop": 3,
        "lieutenant_and_lackeys": 2,
        "elite_enemies": 1,
        "boss_and_lieutenant": 1,
        "boss_and_lackeys": 1,
    }
    template_choices = []
    for key, weight in template_weights.items():
        template_choices.extend([key] * weight)

    selected_key = random.choice(template_choices)
    return generate_encounter_from_template(
        selected_key,
        party_level,
        party_size,
        terrain,
        monster_index,
        terrain_mapping,
        ai_callback=ai_callback,
    )


def generate_custom_encounter(
    party_level,
    party_size,
    difficulty,
    terrain,
    monster_index,
    terrain_mapping,
    ai_callback=None,
):
    """Build an encounter by filling an XP budget with viable monsters."""
    xp_budget = calculate_xp_budget(party_size, difficulty)
    terrain_monsters = [
        monster for monster in monster_index if monster_matches_terrain(monster, terrain, terrain_mapping)
    ]
    if not terrain_monsters:
        return f"No monsters found for terrain: {terrain}", None

    min_level = max(-1, party_level - 4)
    max_level = party_level + 4
    viable_monsters = [
        monster for monster in terrain_monsters if min_level <= monster["level"] <= max_level
    ]
    if not viable_monsters:
        return f"No monsters in appropriate level range for {terrain}", None

    encounter_creatures = []
    current_xp = 0
    attempts = 0

    while current_xp < xp_budget and len(encounter_creatures) < 8 and attempts < 100:
        attempts += 1
        monster = random.choice(viable_monsters)
        monster_xp = get_creature_xp(monster["level"], party_level)

        if current_xp + monster_xp <= xp_budget + 20:
            encounter_creatures.append(monster)
            current_xp += monster_xp
            if abs(current_xp - xp_budget) <= 15:
                break

    output = f"""
Custom Encounter Generated:
{'=' * 50}
Party: {party_size} characters, Level {party_level}
Difficulty: {difficulty.capitalize()}
XP Budget: {xp_budget} (Actual: {current_xp})
Terrain: {format_terrain_name(terrain)}

Creatures:
{'-' * 50}
"""

    monster_counts = Counter(monster["name"] for monster in encounter_creatures)
    shown = set()

    for monster in encounter_creatures:
        if monster["name"] in shown:
            continue
        shown.add(monster["name"])
        count = monster_counts[monster["name"]]
        xp = get_creature_xp(monster["level"], party_level)

        if count > 1:
            output += f"\n{count}x {monster['name']}"
        else:
            output += f"\n{monster['name']}"

        output += f"\n  Level {monster['level']} | HP {monster['hp']} | AC {monster['ac']} | {xp} XP each"
        if monster.get("remaster"):
            output += " [Remaster]"
        output += "\n"

    monsters_for_ai = [{"name": monster["name"], "level": monster["level"]} for monster in encounter_creatures]
    ai_narrative = (
        ai_callback(output, terrain, f"Custom {difficulty.capitalize()} Encounter", monsters_for_ai)
        if ai_callback
        else None
    )
    output += _build_narrative_block(ai_narrative)

    encounter_data = _build_encounter_data(
        f"Custom {difficulty.capitalize()}",
        difficulty,
        party_level,
        party_size,
        terrain,
        xp_budget,
        monsters_for_ai,
        ai_narrative,
    )
    return output, encounter_data
