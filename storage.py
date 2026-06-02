"""Persistence and file-loading helpers.

This module groups together the code that talks to files and the SQLite
database. Keeping I/O separate from game logic makes the core rules easier to
test and easier to reuse in a future GUI or Foundry module.
"""

import json
import sqlite3
from datetime import date

from constants import DB_FILE


def init_database(db_file=DB_FILE, verbose=False):
    """Create the SQLite table used for storing generated NPCs.

    The verbose flag exists so the CLI can opt-in to confirmation messages
    while normal callers (and the test suite) stay silent.
    """
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS npcs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            race TEXT NOT NULL,
            sex TEXT NOT NULL,
            appearance TEXT,
            personality TEXT,
            occupation TEXT,
            motivation TEXT,
            secret TEXT,
            quote TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()
    # Only announce success when explicitly asked; keeps test output clean.
    if verbose:
        print("Database initialized successfully.")


def save_npc_to_db(npc_data, db_file=DB_FILE):
    """Save one generated NPC record into SQLite."""
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO npcs (name, race, sex, appearance, personality, occupation, motivation, secret, quote)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                npc_data.get("name"),
                npc_data.get("race"),
                npc_data.get("sex"),
                npc_data.get("appearance"),
                npc_data.get("personality"),
                npc_data.get("occupation"),
                npc_data.get("motivation"),
                npc_data.get("secret"),
                npc_data.get("quote"),
            ),
        )
        conn.commit()
        conn.close()
        return True
    except Exception as exc:
        print(f"Error saving NPC to database: {exc}")
        return False


def init_encounters_table(db_file=DB_FILE):
    """Create the SQLite table used for storing generated encounters."""
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS encounters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_date DATE NOT NULL,
            session_name TEXT,
            template_type TEXT,
            difficulty TEXT,
            party_level INTEGER NOT NULL,
            party_size INTEGER NOT NULL,
            terrain TEXT NOT NULL,
            xp_budget INTEGER,
            monsters_json TEXT NOT NULL,
            setting_description TEXT,
            monster_description TEXT,
            encounter_hook TEXT,
            tactical_notes TEXT,
            battle_map_details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    conn.close()


def load_npc_names(filename="npc_names.json"):
    """Load name tables from JSON.

    Returning an empty dictionary instead of exiting keeps imports safe and
    makes failures easier to handle from a GUI later.
    """
    try:
        with open(filename, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"Error: {filename} was not found.")
        return {}
    except json.JSONDecodeError as exc:
        print(f"Error: {filename} has invalid JSON syntax: {exc}")
        return {}


def save_npc_to_file(npc_data, filename="npcs.json"):
    """Append an NPC to a JSON file on disk."""
    try:
        try:
            with open(filename, "r", encoding="utf-8") as file:
                npcs = json.load(file)
        except FileNotFoundError:
            npcs = []

        npcs.append(npc_data)

        with open(filename, "w", encoding="utf-8") as file:
            json.dump(npcs, file, indent=2, ensure_ascii=False)

        return True
    except Exception as exc:
        print(f"Error saving NPC to file: {exc}")
        return False


def save_encounter_to_db(encounter_data, db_file=DB_FILE):
    """Save one encounter record into SQLite."""
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        session_date = date.today().isoformat()
        monsters_json = json.dumps(encounter_data.get("monsters", []))

        cursor.execute(
            """
            INSERT INTO encounters (
                session_date, template_type, difficulty, party_level, party_size,
                terrain, xp_budget, monsters_json, setting_description,
                monster_description, encounter_hook, tactical_notes, battle_map_details
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_date,
                encounter_data.get("template_type"),
                encounter_data.get("difficulty"),
                encounter_data.get("party_level"),
                encounter_data.get("party_size"),
                encounter_data.get("terrain"),
                encounter_data.get("xp_budget"),
                monsters_json,
                encounter_data.get("setting_description"),
                encounter_data.get("monster_description"),
                encounter_data.get("encounter_hook"),
                encounter_data.get("tactical_notes"),
                encounter_data.get("battle_map_details"),
            ),
        )

        conn.commit()
        conn.close()
        return True
    except Exception as exc:
        print(f"Error saving encounter to database: {exc}")
        return False


def fetch_saved_npcs(db_file=DB_FILE):
    """Read all saved NPCs from the database and return them as dicts.

    Returning structured data (not text) means a future GUI can display the
    same records without parsing console output. The CLI side is handled by
    print_saved_npcs().
    """
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM npcs ORDER BY created_at DESC")
        rows = cursor.fetchall()
        conn.close()
    except Exception as exc:
        print(f"Error reading from database: {exc}")
        return []

    # Build dicts so callers don't depend on tuple ordering from SQLite.
    records = []
    for row in rows:
        npc_id, name, race, sex, appearance, personality, occupation, motivation, secret, quote, created_at = row
        records.append(
            {
                "id": npc_id,
                "name": name,
                "race": race,
                "sex": sex,
                "appearance": appearance,
                "personality": personality,
                "occupation": occupation,
                "motivation": motivation,
                "secret": secret,
                "quote": quote,
                "created_at": created_at,
            }
        )
    return records


def format_npc_record(record):
    """Format a single NPC dict into the multi-line text the CLI prints."""
    # Match the exact layout the original view_saved_npcs produced, so any
    # downstream snapshot/manual review of CLI output stays consistent.
    lines = [
        f"ID: {record['id']} | {record['name']} ({record['race']}, {record['sex']})",
        f"Created: {record['created_at']}",
        f"Occupation: {record['occupation']}",
        f"Personality: {record['personality']}",
        f"Motivation: {record['motivation']}",
        f"Secret: {record['secret']}",
        f'Quote: "{record["quote"]}"',
        "",
        f"Appearance: {record['appearance']}",
        f"{'-' * 50}",
        "",
    ]
    return "\n".join(lines)


def print_saved_npcs(db_file=DB_FILE):
    """CLI helper: load saved NPCs and print them, preserving the old behavior."""
    records = fetch_saved_npcs(db_file=db_file)

    if not records:
        print("\nNo NPCs saved yet.")
        return

    print(f"\n{'=' * 50}")
    print(f"SAVED NPCs ({len(records)} total)")
    print(f"{'=' * 50}\n")

    for record in records:
        print(format_npc_record(record))


# Backwards-compatible alias. Older code (and any user scripts) that still
# call view_saved_npcs() will continue to work, but new code should call
# print_saved_npcs() directly.
view_saved_npcs = print_saved_npcs


def load_monster_index(index_file="monster_index.json"):
    """Load the lightweight monster cache used for encounter generation."""
    try:
        with open(index_file, "r", encoding="utf-8") as file:
            monsters = json.load(file)
        print(f"Loaded {len(monsters)} monsters from index.")
        return monsters
    except FileNotFoundError:
        print(f"ERROR: {index_file} not found!")
        print("Run 'python build_monster_index.py' first to create the index.")
        return []
    except json.JSONDecodeError as exc:
        print(f"ERROR: {index_file} has invalid JSON: {exc}")
        return []


def load_terrain_mapping(mapping_file="terrain_mapping.json"):
    """Load the terrain-to-trait mapping used by encounter filtering."""
    try:
        with open(mapping_file, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"ERROR: {mapping_file} not found!")
        print("Create terrain_mapping.json before running.")
        return {"terrain_definitions": {}}
    except json.JSONDecodeError as exc:
        print(f"ERROR: {mapping_file} has invalid JSON: {exc}")
        return {"terrain_definitions": {}}
