"""AI helpers for optional Gemini-powered content generation.

This module is written to be safe to import even when the Gemini SDK is not
installed. That matters because the non-AI parts of the toolkit should still
work for tests, local development, and future GUI work.
"""

import json
import os

from dotenv import load_dotenv

from utils import format_terrain_name

try:
    # Import lazily and defensively so the rest of the project can run
    # without the optional AI dependency installed.
    from google import genai
except ImportError:  # pragma: no cover - environment dependent
    genai = None


load_dotenv()

_client = None


def get_gemini_client():
    """Return a Gemini client if the SDK and API key are available.

    A helper like this is called "lazy initialization": we do not create the
    client at import time. Instead, we only build it the first time AI is
    actually requested.
    """
    global _client

    if _client is not None:
        return _client

    api_key = os.getenv("GEMINI_API_KEY")
    if genai is None or not api_key:
        return None

    _client = genai.Client(api_key=api_key)
    return _client


def _clean_json_response(raw_text):
    """Strip common markdown fences before parsing AI-generated JSON."""
    return (
        raw_text.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )


def enhance_npc_with_ai(name, race_display, sex):
    """Ask Gemini for richer narrative NPC details.

    Returns a dictionary on success, or None on failure. Returning None lets
    the caller fall back to the simple non-AI generation path.
    """
    client = get_gemini_client()
    if client is None:
        print("\nWarning: Gemini AI is unavailable. Using basic NPC generation.")
        return None

    prompt = f"""You are a Pathfinder 2e game master creating a memorable NPC.

Given this basic information:
- Name: {name}
- Race: {race_display}
- Sex: {sex}

Generate detailed narrative content for this NPC. Respond ONLY with valid JSON in this exact format:
{{
  "appearance": "2-3 sentence physical description",
  "personality": "2-3 sentence personality description with a distinctive quirk or mannerism",
  "occupation": "a specific occupation that fits this character",
  "motivation": "their primary goal or driving force",
  "secret": "an interesting secret or hidden aspect",
  "quote": "a memorable thing they might say"
}}

Make the NPC interesting and memorable. Be specific and creative."""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return json.loads(_clean_json_response(response.text))
    except Exception as exc:  # pragma: no cover - external service path
        print(f"\nWarning: AI enhancement failed: {exc}")
        print("Generating basic NPC without AI details.")
        return None


def enhance_encounter_with_ai(encounter_summary, terrain, template_name, monsters):
    """Ask Gemini for flavorful narrative details around an encounter."""
    client = get_gemini_client()
    if client is None:
        print("\nWarning: Gemini AI is unavailable. Showing basic encounter only.\n")
        return None

    monster_list = "\n".join([f"- {m['name']} (Level {m['level']})" for m in monsters])

    prompt = f"""You are a Pathfinder 2e game master creating a memorable combat encounter.

Given this encounter setup:
Terrain: {format_terrain_name(terrain)}
Encounter Type: {template_name}
Monsters:
{monster_list}

Generate vivid narrative content for this encounter. Respond ONLY with valid JSON in this exact format, no other text:
{{
  "setting_description": "3-5 sentence vivid description of the environment and atmosphere",
  "monster_description": "3-5 sentences describing what the monsters look like and how they're positioned/behaving",
  "encounter_hook": "Why are these creatures here? What's the situation the party is walking into?",
  "tactical_notes": "1-2 interesting terrain features or tactical elements that make this fight memorable",
  "battle_map_details": "Specific battle map setup: approximate dimensions (e.g., 30x40 feet), key terrain features and their positions (e.g., 'large boulder northwest corner', 'stream running diagonally'), elevation changes, cover locations, and suggested monster starting positions. Be specific enough to set up a physical or digital map."
}}

Make it atmospheric and specific to the terrain and creatures. Avoid generic descriptions.

Mechanical summary:
{encounter_summary}
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return json.loads(_clean_json_response(response.text))
    except Exception as exc:  # pragma: no cover - external service path
        print(f"\nWarning: Encounter AI enhancement failed: {exc}")
        print("Showing basic encounter without narrative details...\n")
        return None
