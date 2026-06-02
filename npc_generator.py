"""Pathfinder GM Toolkit entrypoint and compatibility layer.

This file now acts as the "front door" to the project:
- it re-exports the core functions so older code and tests still work
- it owns the command-line interface
- it documents how the project is split into smaller educational modules

That split is important because GUI applications and Foundry modules both work
best when game logic is separate from menu/input code.
"""

from ai_tools import enhance_encounter_with_ai, enhance_npc_with_ai
from constants import TERRAIN_TYPES
from encounter_logic import (
    calculate_xp_budget,
    format_terrain_name,
    generate_custom_encounter as _generate_custom_encounter,
    generate_encounter_from_template as _generate_encounter_from_template,
    generate_random_encounter as _generate_random_encounter,
    get_creature_xp,
    get_encounter_templates,
    monster_matches_terrain,
)
from npc_logic import generate_npc
from storage import (
    init_database,
    init_encounters_table,
    load_monster_index,
    load_npc_names,
    load_terrain_mapping,
    print_saved_npcs,
    save_encounter_to_db,
    save_npc_to_db,
    save_npc_to_file,
)


def get_valid_number(prompt, min_value, max_value):
    """Prompt until the user enters a number in the allowed range."""
    while True:
        user_input = input(prompt)
        try:
            number = int(user_input)
            if min_value <= number <= max_value:
                return number
            print(f"Please enter a number between {min_value} and {max_value}.")
        except ValueError:
            print("That's not a valid number. Please try again.")


def get_valid_terrain():
    """Let the user pick a terrain by name or menu number."""
    print("\nAvailable terrains:")
    for index, terrain in enumerate(TERRAIN_TYPES, start=1):
        print(f" {index}. {format_terrain_name(terrain)}")

    while True:
        user_input = input("\nEnter terrain name or number: ").lower().strip()
        if user_input.isdigit():
            choice = int(user_input)
            if 1 <= choice <= len(TERRAIN_TYPES):
                return TERRAIN_TYPES[choice - 1]
            print(f"Please enter a number between 1 and {len(TERRAIN_TYPES)}.")
        elif user_input in TERRAIN_TYPES:
            return user_input
        else:
            print("Invalid terrain. Please try again.")


def get_party_size():
    """Prompt for party size while supporting a simple default."""
    user_input = input("Enter party size (default 4): ").strip()
    if not user_input:
        return 4

    try:
        size = int(user_input)
        if 1 <= size <= 8:
            return size
        print("Party size must be 1-8. Using default of 4.")
        return 4
    except ValueError:
        print("Invalid input. Using default party size of 4.")
        return 4


def get_difficulty():
    """Prompt for one of the supported encounter difficulty labels."""
    print("\nSelect encounter difficulty:")
    print("  1. Trivial (easy warm-up)")
    print("  2. Low (minor challenge)")
    print("  3. Moderate (standard encounter)")
    print("  4. Severe (serious threat)")
    print("  5. Extreme (potential TPK)")

    difficulties = ["trivial", "low", "moderate", "severe", "extreme"]

    while True:
        choice = input("\nEnter difficulty (1-5, default 3): ").strip()
        if not choice:
            return "moderate"
        if choice.isdigit():
            choice_num = int(choice)
            if 1 <= choice_num <= 5:
                return difficulties[choice_num - 1]
        print("Invalid choice. Please enter 1-5.")


def select_encounter_template():
    """Prompt for one of the predefined encounter templates."""
    print("\nSelect encounter template:")
    print("  1. Boss and Lackeys (Severe, 120 XP)")
    print("  2. Boss and Lieutenant (Severe, 120 XP)")
    print("  3. Elite Enemies (Severe, 120 XP)")
    print("  4. Lieutenant and Lackeys (Moderate, 80 XP)")
    print("  5. Mated Pair (Moderate, 80 XP)")
    print("  6. Troop (Moderate, 80 XP)")
    print("  7. Mook Squad (Low, 60 XP)")

    template_keys = [
        "boss_and_lackeys",
        "boss_and_lieutenant",
        "elite_enemies",
        "lieutenant_and_lackeys",
        "mated_pair",
        "troop",
        "mook_squad",
    ]

    while True:
        choice = input("\nEnter template (1-7): ").strip()
        if choice.isdigit():
            choice_num = int(choice)
            if 1 <= choice_num <= 7:
                return template_keys[choice_num - 1]
        print("Invalid choice. Please enter 1-7.")


def generate_encounter_from_template(template_key, party_level, party_size, terrain, monster_index, terrain_mapping=None):
    """Compatibility wrapper that injects AI enrichment into core logic.

    If terrain_mapping is not supplied we load it on demand. Passing it
    explicitly (the preferred path) avoids reloading JSON on every call.
    """
    if terrain_mapping is None:
        terrain_mapping = load_terrain_mapping()
    return _generate_encounter_from_template(
        template_key,
        party_level,
        party_size,
        terrain,
        monster_index,
        terrain_mapping,
        ai_callback=enhance_encounter_with_ai,
    )


def generate_random_encounter(party_level, party_size, terrain, monster_index, terrain_mapping=None):
    """Compatibility wrapper for weighted template-based encounters."""
    if terrain_mapping is None:
        terrain_mapping = load_terrain_mapping()
    return _generate_random_encounter(
        party_level,
        party_size,
        terrain,
        monster_index,
        terrain_mapping,
        ai_callback=enhance_encounter_with_ai,
    )


def generate_custom_encounter(party_level, party_size, difficulty, terrain, monster_index, terrain_mapping=None):
    """Compatibility wrapper for custom XP-budget encounters."""
    if terrain_mapping is None:
        terrain_mapping = load_terrain_mapping()
    return _generate_custom_encounter(
        party_level,
        party_size,
        difficulty,
        terrain,
        monster_index,
        terrain_mapping,
        ai_callback=enhance_encounter_with_ai,
    )


def run_cli():
    """Run the original text-menu application on top of the refactored modules."""
    print("=" * 50)
    print("  PATHFINDER 2E GM TOOLKIT")
    print("=" * 50)

    monster_index = load_monster_index()
    terrain_mapping = load_terrain_mapping()

    init_database(verbose=True)
    init_encounters_table()

    if not monster_index:
        print("\nCannot run without monster index.")
        print("Please run 'python build_monster_index.py' first.")
        return

    print(f"Loaded {len(monster_index)} monsters")

    while True:
        print("\n" + "=" * 50)
        print("What would you like to generate?")
        print("  1. NPC (Basic - Fast)")
        print("  2. NPC (AI-Enhanced - Detailed)")
        print("  3. Random Encounter (quick)")
        print("  4. Custom Encounter (choose difficulty)")
        print("  5. Encounter from Template")
        print("  6. Both NPC + Random Encounter")
        print("  7. View Saved NPCs")
        print("  8. Exit")

        choice = input("\nEnter your choice (1-8): ").strip()

        if choice == "1":
            npc_text, npc_data = generate_npc(use_ai=False)
            print("\n" + "=" * 50)
            print(npc_text)

        elif choice == "2":
            npc_text, npc_data = generate_npc(use_ai=True)
            print("\n" + "=" * 50)
            print(npc_text)

            if npc_data:
                save_choice = input("\nSave this NPC to database? (y/n): ").strip().lower()
                if save_choice == "y":
                    if save_npc_to_db(npc_data):
                        print("NPC saved successfully!")
                    else:
                        print("Failed to save NPC.")

        elif choice == "3":
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()
            print("\nGenerating random encounter...")
            encounter_text, encounter_data = generate_random_encounter(
                party_level, party_size, terrain, monster_index, terrain_mapping
            )
            print(encounter_text)
            _offer_encounter_save(encounter_data)

        elif choice == "4":
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            difficulty = get_difficulty()
            terrain = get_valid_terrain()
            print("\nGenerating custom encounter...")
            encounter_text, encounter_data = generate_custom_encounter(
                party_level, party_size, difficulty, terrain, monster_index, terrain_mapping
            )
            print(encounter_text)
            _offer_encounter_save(encounter_data)

        elif choice == "5":
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()
            template_key = select_encounter_template()
            print("\nGenerating encounter from template...")
            encounter_text, encounter_data = generate_encounter_from_template(
                template_key, party_level, party_size, terrain, monster_index, terrain_mapping
            )
            print(encounter_text)
            _offer_encounter_save(encounter_data)

        elif choice == "6":
            print("\n" + "=" * 50)
            npc_text, npc_data = generate_npc(use_ai=True)
            print(npc_text)

            party_level = get_valid_number("\nEnter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()

            print("\nGenerating random encounter...")
            encounter_text, encounter_data = generate_random_encounter(
                party_level, party_size, terrain, monster_index, terrain_mapping
            )
            print(encounter_text)

            if npc_data:
                save_choice = input("\nSave this NPC to database? (y/n): ").strip().lower()
                if save_choice == "y":
                    save_npc_to_db(npc_data)

            _offer_encounter_save(encounter_data)

        elif choice == "7":
            print_saved_npcs()

        elif choice == "8":
            print("\nThanks for using the GM Toolkit!")
            break

        else:
            print("\nInvalid choice. Please enter 1-8.")


def _offer_encounter_save(encounter_data):
    """Small helper to keep the main menu readable.

    Breaking repeated CLI actions into helpers is a gentle introduction to one
    of the main goals of refactoring: fewer giant functions and fewer repeated
    code blocks.
    """
    if not encounter_data:
        return

    save_choice = input("\nSave this encounter to database? (y/n): ").strip().lower()
    if save_choice == "y":
        if save_encounter_to_db(encounter_data):
            print("Encounter saved successfully!")
        else:
            print("Failed to save encounter.")


if __name__ == "__main__":
    run_cli()
