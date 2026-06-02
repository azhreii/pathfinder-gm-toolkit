"""NPC generation logic.

This file focuses on "how to build an NPC" and deliberately avoids the menu
loop or database setup. That separation is one of the key refactors that will
make a future GUI much easier to build.
"""

import random

from ai_tools import enhance_npc_with_ai
from constants import OCCUPATIONS, PERSONALITY_TRAITS
from storage import load_npc_names


def _get_race_display_name(race_key, race_data):
    """Turn an internal race key into something friendly for display."""
    if "display_name" in race_data:
        return race_data["display_name"]

    if "_" in race_key:
        parts = race_key.split("_")
        return f"{parts[0].capitalize()} ({parts[1].capitalize()})"

    return race_key.capitalize()


def generate_npc(use_ai=True, names_data=None):
    """Generate one NPC and return both text and structured data.

    Returning both forms is useful:
    - the formatted text is great for a CLI or text box
    - the dictionary is better for saving to a database or showing in a GUI
    """
    if names_data is None:
        names_data = load_npc_names()

    if not names_data:
        return "NPC name data is unavailable. Check npc_names.json.", None

    available_races = list(names_data.keys())
    race_key = random.choice(available_races)
    sex = random.choice(["male", "female"])

    first_name = random.choice(names_data[race_key][sex])
    surname = random.choice(names_data[race_key]["surnames"])
    full_name = f"{first_name} {surname}"
    race_display = _get_race_display_name(race_key, names_data[race_key])

    if use_ai:
        ai_details = enhance_npc_with_ai(full_name, race_display, sex)
        if ai_details:
            npc_description = f"""
NPC Generated (AI-Enhanced):
{'=' * 50}
Name: {full_name}
Race: {race_display}
Sex: {sex.capitalize()}

Appearance:
{ai_details.get('appearance', 'N/A')}

Personality:
{ai_details.get('personality', 'N/A')}

Occupation:
{ai_details.get('occupation', 'N/A')}

Motivation:
{ai_details.get('motivation', 'N/A')}

Secret:
{ai_details.get('secret', 'N/A')}

Signature Quote:
"{ai_details.get('quote', 'N/A')}"
"""
            npc_data = {
                "name": full_name,
                "race": race_display,
                "sex": sex.capitalize(),
                "appearance": ai_details.get("appearance", "N/A"),
                "personality": ai_details.get("personality", "N/A"),
                "occupation": ai_details.get("occupation", "N/A"),
                "motivation": ai_details.get("motivation", "N/A"),
                "secret": ai_details.get("secret", "N/A"),
                "quote": ai_details.get("quote", "N/A"),
            }
            return npc_description, npc_data

    job = random.choice(OCCUPATIONS)
    personality_trait = random.choice(PERSONALITY_TRAITS)
    npc_description = f"""
NPC Generated:
{'=' * 50}
Name: {full_name}
Race: {race_display}
Sex: {sex.capitalize()}
Occupation: {job}
Personality: {personality_trait}
"""
    return npc_description, None
