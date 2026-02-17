# Pathfinder GM Toolkit - NPC and Encounter Generator Version 0.1
import json
import random
import os

def load_npc_names():
    """
    Loads NPC Name data from npc_names.json file

    Returns:
    Dictionary with race -> sex -> names structure
    """
    try:
        with open('npc_names.json', 'r') as file:
            names_data = json.load(file)
            return names_data
    except FileNotFoundError:
        print("Error: npc_names.json file is not found!")
        print("Make sure npc_names.json is in the same folder as npc_generator.py")
        exit()
    except json.JSONDecodeError as e:
        print(f"Error: npc_names.json has invalid JSON syntax!")
        print(f"Details: {e}")
        exit()

# Occupations - Add Homebrew occupations to list here
occupations = [
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
    "Apothecary"
]

#Personality Traits - Add Homebrew traits to list here
personality_traits = [
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
    "Sexist",
    "Racist"
]

# Available Terrain types - must match terrain_mapping.json exactly
terrain_types = [
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
    "any"
]

# Load NPC names for JSON file
npc_names_data = load_npc_names()

def generate_npc():
    """
    Generates a random NPC with name, occupation, and trait.
    Returns the NPC as a formatted string.
    """

    # Pick a random race/subrace from available races
    available_races = list(npc_names_data.keys())
    race_key = random.choice(available_races)

    # Pick a random sex
    sex = random.choice(["male", "female"])

    # Get appropriate first name based on race and sex
    first_name = random.choice(npc_names_data[race_key][sex])

    # Get surname from that race's surname list
    surname = random.choice(npc_names_data[race_key]["surnames"])

    # Combine first and last name
    full_name = f"{first_name} {surname}"

    # Get display name (or fall back to parsin race_key)
    if "display_name" in npc_names_data[race_key]:
        race_display = npc_names_data[race_key]["display_name"]
    else:
        # Fallback: parse race_key if no display_name provided
        if "_" in race_key:
            parts = race_key.split("_")
            race_display = f"{parts[0].capitalize()} ({parts[1].capitalize()})"
        else:
            race_display = race_key.capitalize()
    # Pick occupation and trait
    job = random.choice(occupations)
    personality = random.choice(personality_traits)

    # Build the description of the NPC
    npc_description = f"""
NPC Generated:
--------------
Name: {full_name}
Race: {race_display}
Sex: {sex.capitalize()}
Occupation: {job}
Personality: {personality}
"""
    
    #Send the description back to whoever called this function.
    return npc_description
def generate_encounter(party_level, terrain):
    """
    Generates a random encounter based on the party's level and terrain.
    
    Parameters:
    - party_level: Integer 1-20 (average level of the party)
    - terrain: String matching one of the terrain_types

    Returns:
    - A formatted string describing the encounter, including monster name, CR, HP, AC, and type.
    """
    # Step 1: Calculate appropriate CR range
    # Party of 4 PCs can handle CR = party level +/- 1
    min_cr = max(1, party_level - 1) # Don't go below CR 1
    max_cr = party_level + 2 # Allow for slightly tougher encounters
    # Step 2: Filter monsters that match terrain and CR range
    suitable_monsters = []
    for monster in monsters:
        # Check if terrain matches
        if terrain in monster["terrain"]:
            # Check if CR is within range
            if min_cr <= monster["cr"] <= max_cr:
                suitable_monsters.append(monster)
    # Step 3: Handle case where no suitable monsters are found
    if len(suitable_monsters) == 0:
        return f"No suitable monsters found for {terrain} at CR {min_cr}--{max_cr}. Try Different terrain or add more monsters!"
    # Step 4: Pick a random monster from suitable ones
    chosen_monster = random.choice(suitable_monsters)
    # Step 5: Build Encounter Description
    encounter_description = f"""
    Encounter Generated:
    ---------------------
    Monster: {chosen_monster["name"]}
    Challenge Rating: {chosen_monster["cr"]}
    Hit Points: {chosen_monster["hp"]}
    Armor Class: {chosen_monster["ac"]}
    Type: {chosen_monster["type"]}
    Terrain: {terrain}
    """
    return encounter_description

def get_valid_number(prompt, min_value, max_value):
    """
    Asks user for a number and validates it's in the allowed range.
    Keeps asking until valid input is received.
    Parameters:
    - prompt: The question to ask the user.
    - min_value: Lowest acceptable number
    - max_value: Highest acceptable number
    Returns:
    - Integer within the valid range.
    """
    while True:
        # Ask the user for input
        user_input = input(prompt)

        # Try to convert it to a number
        try:
            number = int(user_input)

            # Check if it's in the valid range
            if min_value <= number <= max_value:
                return number
            else:
                print(f"Please enter a number between {min_value} and {max_value}.")

        except ValueError:
                # This runs if int() fails (user typed letters, not a number)
                print("That's not a valid number. Please try again.")

def get_valid_terrain():
    """
    Asks user to choose a terrain type.
    Shows available options and validates input.

    Returns:
    - Valid terrain string (lowercase)
    """
    print("\nAvailable terrains:")
    # Display all terrain options with numbers for easy selection
    for i, terrain in enumerate(terrain_types):
        print(f" {i + 1}. {format_terrain_name(terrain)}")
    while True:
        user_input = input("\nEnter terrain name or number: ").lower().strip()

        #Check if they entered a number
        if user_input.isdigit():
            choice = int(user_input)
            # Check if number is valid ( 1 to length of terrain_types)
            if 1 <= choice <= len(terrain_types):
                return terrain_types[choice - 1]
            else:
                print(f"Please enter a number between 1 and {len(terrain_types)}.")

        # Check if they typed a valid terrain name
        elif user_input in terrain_types:
            return user_input

        else:
            print("Invalid terrain. Please try again.")    


def load_monster_index(index_file="monster_index.json"):
    """
    Loads the pre-built monster index from file.
    
    Parameters:
    - index_file: Path to the monster index JSON file
    
    Returns:
    - List of monster dictionaries
    """
    try:
        with open(index_file, 'r', encoding='utf-8') as file:
            monsters = json.load(file)
            print(f"Loaded {len(monsters)} monsters from index.")
            return monsters
    
    except FileNotFoundError:
        print(f"ERROR: {index_file} not found!")
        print("Run 'python build_monster_index.py' first to create the index.")
        return []
    
    except json.JSONDecodeError as e:
        print(f"ERROR: {index_file} has invalid JSON: {e}")
        return []


def load_terrain_mapping(mapping_file="terrain_mapping.json"):
    """
    Loads terrain mapping definitions from file.
    
    Parameters:
    - mapping_file: Path to the terrain mapping JSON file
    
    Returns:
    - Dictionary with terrain definitions
    """
    try:
        with open(mapping_file, 'r', encoding='utf-8') as file:
            mapping = json.load(file)
            return mapping
    
    except FileNotFoundError:
        print(f"ERROR: {mapping_file} not found!")
        print("Create terrain_mapping.json before running.")
        return {"terrain_definitions": {}}
    
    except json.JSONDecodeError as e:
        print(f"ERROR: {mapping_file} has invalid JSON: {e}")
        return {"terrain_definitions": {}}

def format_terrain_name(terrain):
    """
    Formats a terrain name for display
    Removes underscores and capitalizes each word
    Examples:
    - "forest" → "Forest"
    - "planar_earth" → "Planar Earth"
    - "first_world" → "First World"
    - "hell" → "Hell"
    
    Parameters:
    - terrain: String terrain key
    
    Returns:
    - Formatted string for display
    """
    return " ".join(part.capitalize() for part in terrain.split("_"))

def monster_matches_terrain(monster, terrain, terrain_mapping):
    """
    Checks if a monster's traits match a given terrain
    by comparing against terrain_mapping.json rules.
    
    Parameters:
    - monster: Monster dictionary (has "traits" field)
    - terrain: String terrain name (e.g., "forest")
    - terrain_mapping: Dictionary loaded from terrain_mapping.json
    
    Returns:
    - Boolean: True if monster belongs in this terrain
    """
    # Check if the requested terrain exists in our mapping
    if terrain not in terrain_mapping["terrain_definitions"]:
        return False
    
    # Get the rules for this specific terrain
    terrain_data = terrain_mapping["terrain_definitions"][terrain]
    
    # Get this monster's traits as a set (faster for comparisons)
    monster_traits = set(monster.get("traits", []))
    
    # Step 1: Check exclusions FIRST
    # If monster has any excluded trait, it can't appear here
    exclude_traits = set(terrain_data.get("exclude_traits", []))
    if monster_traits & exclude_traits:
        return False
    
    # Step 2: Check creature types
    creature_types = set(terrain_data.get("creature_types", []))
    if monster_traits & creature_types:
        return True
    
    # Step 3: Check special traits
    special_traits = set(terrain_data.get("special_traits", []))
    if monster_traits & special_traits:
        return True
    
    # Step 4: Check specific ancestries
    specific_ancestries = set(terrain_data.get("specific_ancestries", []))
    if monster_traits & specific_ancestries:
        return True
    
    # Nothing matched
    return False

def get_creature_xp(creature_level, party_level):
    """
    Returns XP value of a creature based on level difference.
    Uses official PF2e Remaster rules.
    
    Parameters:
    - creature_level: The creature's level
    - party_level: The party's average level
    
    Returns:
    - Integer XP value for encounter building
    """
    # Calculate the level difference
    level_diff = creature_level - party_level
    
    # XP values based on official PF2e table
    xp_by_difference = {
        -4: 10,   # 4 levels below party
        -3: 15,   # 3 levels below party
        -2: 20,   # 2 levels below party
        -1: 30,   # 1 level below party
        0: 40,    # Same level as party
        1: 60,    # 1 level above party
        2: 80,    # 2 levels above party
        3: 120,   # 3 levels above party
        4: 160    # 4 levels above party
    }
    
    # Handle creatures more than 4 levels different
    if level_diff < -4:
        return 10  # Trivial threat
    elif level_diff > 4:
        return 160  # Extreme threat
    
    # Return the XP value from the table
    return xp_by_difference.get(level_diff, 40)

def calculate_xp_budget(party_size, difficulty):
    """
    Calculates XP budget based on party size and difficulty.
    Uses official PF2e Remaster rules with proper character adjustments.
    
    Parameters:
    - party_size: Number of PCs (typically 3-6)
    - difficulty: "trivial", "low", "moderate", "severe", "extreme"
    
    Returns:
    - Integer XP budget for building the encounter
    """
    # Base XP budgets for party of 4 (from official rules)
    base_budgets = {
        "trivial": 40,
        "low": 60,
        "moderate": 80,
        "severe": 120,
        "extreme": 160
    }
    
    # Character adjustment varies by difficulty (from official rules)
    # This is how much to add/subtract per character above/below 4
    char_adjustments = {
        "trivial": 10,
        "low": 20,
        "moderate": 20,
        "severe": 30,
        "extreme": 40
    }
    
    # Get base budget for this difficulty
    base_xp = base_budgets.get(difficulty, 80)  # Default to moderate if invalid
    
    # Get adjustment amount for this difficulty
    adjustment_per_char = char_adjustments.get(difficulty, 20)
    
    # Calculate how many characters above/below 4
    size_difference = party_size - 4
    
    # Calculate total adjustment
    adjustment = size_difference * adjustment_per_char
    
    # Return adjusted budget
    return base_xp + adjustment

def get_encounter_templates():
    """
    Returns the official PF2e "Quick Adventure Groups" encounter templates.
    These are pre-built encounter structures from the GM Core.
    
    Returns:
    - Dictionary of template names to their structures
    """
    return {
        "boss_and_lackeys": {
            "name": "Boss and Lackeys",
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 1, "level_mod": 2, "role": "Boss"},
                {"count": 4, "level_mod": -4, "role": "Lackey"}
            ]
        },
        "boss_and_lieutenant": {
            "name": "Boss and Lieutenant", 
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 1, "level_mod": 2, "role": "Boss"},
                {"count": 1, "level_mod": 0, "role": "Lieutenant"}
            ]
        },
        "elite_enemies": {
            "name": "Elite Enemies",
            "xp": 120,
            "difficulty": "severe",
            "structure": [
                {"count": 3, "level_mod": 0, "role": "Elite"}
            ]
        },
        "lieutenant_and_lackeys": {
            "name": "Lieutenant and Lackeys",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 1, "level_mod": 0, "role": "Lieutenant"},
                {"count": 4, "level_mod": -4, "role": "Lackey"}
            ]
        },
        "mated_pair": {
            "name": "Mated Pair",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 2, "level_mod": 0, "role": "Standard"}
            ]
        },
        "troop": {
            "name": "Troop",
            "xp": 80,
            "difficulty": "moderate",
            "structure": [
                {"count": 1, "level_mod": 0, "role": "Leader"},
                {"count": 2, "level_mod": -2, "role": "Soldier"}
            ]
        },
        "mook_squad": {
            "name": "Mook Squad",
            "xp": 60,
            "difficulty": "low",
            "structure": [
                {"count": 6, "level_mod": -4, "role": "Mook"}
            ]
        }
    }

def generate_encounter_from_template(template_key, party_level, party_size, terrain, monster_index):
    """
    Generates an encounter using an official PF2e template.
    Fills the template structure with appropriate monsters from the index.
    
    Parameters:
    - template_key: Key from get_encounter_templates() (e.g., "boss_and_lackeys")
    - party_level: Integer 1-20
    - terrain: String terrain type
    - monster_index: List of monster dictionaries
    
    Returns:
    - Formatted encounter string or error message
    """
    # Get all available templates
    templates = get_encounter_templates()
    
    # Validate the requested template exists
    if template_key not in templates:
        return "Invalid template selected."
    
    # Get the specific template
    template = templates[template_key]
    
    # Filter monsters by terrain
    terrain_monsters = [
    m for m in monster_index
    if monster_matches_terrain(m, terrain, terrain_mapping)
    ]
    
    if not terrain_monsters:
        return f"No monsters found for terrain: {terrain}"
    
    # Build encounter by filling each slot in the template
    encounter_creatures = []
    
    # Loop through each group in the template structure
    for group in template["structure"]:
        # Calculate what level we need for this group
        target_level = party_level + group["level_mod"]
        
        # Find monsters at exactly this level
        level_matches = [
            m for m in terrain_monsters
            if m["level"] == target_level
        ]
        
        # If no exact matches, try +/- 1 level
        if not level_matches:
            level_matches = [
                m for m in terrain_monsters
                if abs(m["level"] - target_level) <= 1
            ]
        
        # If still no matches, can't build this encounter
        if not level_matches:
            return f"Cannot build {template['name']} - no monsters found at level {target_level} for {terrain}"
        
        # Pick random monsters for this group (can pick same monster multiple times)
        for _ in range(group["count"]):
            monster = random.choice(level_matches)
            encounter_creatures.append({
                "monster": monster,
                "role": group["role"]
            })
    
    # Build output string
    output = f"""
Encounter Generated: {template['name']}
{'='*50}
Party Level: {party_level} (assumes 4 PCs)
Difficulty: {template['difficulty'].capitalize()}
XP Budget: {template['xp']} XP
Terrain: {format_terrain_name(terrain)}

Creatures:
{'-'*50}
"""
    
    # Group identical monsters together for cleaner output
    from collections import defaultdict
    role_groups = defaultdict(list)
    
    # Group by (role, monster name)
    for entry in encounter_creatures:
        key = (entry["role"], entry["monster"]["name"])
        role_groups[key].append(entry["monster"])
    
    # Display each unique monster
    for (role, name), monsters in role_groups.items():
        count = len(monsters)
        monster = monsters[0]  # Get stats from first instance
        xp = get_creature_xp(monster["level"], party_level)
        
        # Show count if more than 1
        if count > 1:
            output += f"\n{count}× {name} ({role})"
        else:
            output += f"\n{name} ({role})"
        
        # Show stats
        output += f"\n  Level {monster['level']} | HP {monster['hp']} | AC {monster['ac']} | {xp} XP each"
        
        # Show remaster indicator
        if monster.get("remaster"):
            output += " ⚙"
        
        output += "\n"
    
    return output

def generate_random_encounter(party_level, party_size, terrain, monster_index):
    """
    Quickly generates a random encounter using weighted template selection.
    Favors moderate/low difficulty for typical random encounters.
    
    Parameters:
    - party_level: Integer 1-20
    - terrain: String terrain type
    - monster_index: List of monster dictionaries
    
    Returns:
    - Formatted encounter string
    """
    templates = get_encounter_templates()
    
    # Weight templates by how often they should appear in random encounters
    # Higher weight = more likely to be selected
    template_weights = {
        "mook_squad": 3,              # 60 XP, Low - very common
        "mated_pair": 3,               # 80 XP, Moderate - very common
        "troop": 3,                    # 80 XP, Moderate - very common
        "lieutenant_and_lackeys": 2,   # 80 XP, Moderate - common
        "elite_enemies": 1,            # 120 XP, Severe - rare
        "boss_and_lieutenant": 1,      # 120 XP, Severe - rare
        "boss_and_lackeys": 1,         # 120 XP, Severe - rare
    }
    
    # Build a list with templates repeated by their weight
    template_choices = []
    for key, weight in template_weights.items():
        template_choices.extend([key] * weight)
    
    # Randomly select from the weighted list
    selected_key = random.choice(template_choices)
    
    # Generate using the selected template
    return generate_encounter_from_template(selected_key, party_level, party_size, terrain, monster_index)

def generate_custom_encounter(party_level, party_size, difficulty, terrain, monster_index):
    """
    Generates a custom encounter by randomly filling an XP budget.
    More flexible than templates, but less structured.
    
    Parameters:
    - party_level: Integer 1-20
    - party_size: Integer number of PCs
    - difficulty: String ("trivial", "low", "moderate", "severe", "extreme")
    - terrain: String terrain type
    - monster_index: List of monster dictionaries
    
    Returns:
    - Formatted encounter string
    """
    # Calculate XP budget based on party size and difficulty
    xp_budget = calculate_xp_budget(party_size, difficulty)
    
    # Filter monsters by terrain
    terrain_monsters = [
        m for m in monster_index 
        if monster_matches_terrain(m, terrain, terrain_mapping)
    ]
    
    if not terrain_monsters:
        return f"No monsters found for terrain: {terrain}"
    
    # Filter to reasonable level range (party -4 to party +4)
    min_level = max(-1, party_level - 4)
    max_level = party_level + 4
    
    viable_monsters = [
        m for m in terrain_monsters
        if min_level <= m["level"] <= max_level
    ]
    
    if not viable_monsters:
        return f"No monsters in appropriate level range for {terrain}"
    
    # Build encounter by randomly adding creatures until budget is met
    encounter_creatures = []
    current_xp = 0
    attempts = 0
    max_attempts = 100      # Prevent infinite loop
    max_creatures = 8        # Cap at 8 creatures for playability
    
    while current_xp < xp_budget and len(encounter_creatures) < max_creatures and attempts < max_attempts:
        attempts += 1
        
        # Randomly pick a monster
        monster = random.choice(viable_monsters)
        monster_xp = get_creature_xp(monster["level"], party_level)
        
        # Would this fit in our budget? (allow slight overage)
        if current_xp + monster_xp <= xp_budget + 20:
            encounter_creatures.append(monster)
            current_xp += monster_xp
            
            # Stop if we're close to target
            if abs(current_xp - xp_budget) <= 15:
                break
    
    # Build output
    output = f"""
Custom Encounter Generated:
{'='*50}
Party: {party_size} characters, Level {party_level}
Difficulty: {difficulty.capitalize()}
XP Budget: {xp_budget} (Actual: {current_xp})
Terrain: {format_terrain_name(terrain)}

Creatures:
{'-'*50}
"""
    
    # Group identical monsters for cleaner display
    from collections import Counter
    monster_counts = Counter(m["name"] for m in encounter_creatures)
    
    # Track which monsters we've already displayed
    shown = set()
    
    for monster in encounter_creatures:
        # Skip if we already showed this monster
        if monster["name"] in shown:
            continue
        shown.add(monster["name"])
        
        count = monster_counts[monster["name"]]
        xp = get_creature_xp(monster["level"], party_level)
        
        # Show count if more than 1
        if count > 1:
            output += f"\n{count}× {monster['name']}"
        else:
            output += f"\n{monster['name']}"
        
        # Show stats
        output += f"\n  Level {monster['level']} | HP {monster['hp']} | AC {monster['ac']} | {xp} XP each"
        
        # Show remaster indicator
        if monster.get("remaster"):
            output += " ⚙"
        
        output += "\n"
    
    return output

def get_party_size():
    """
    Prompts for party size with default of 4.
    Allows user to just press Enter for default.
    
    Returns:
    - Integer party size (1-8)
    """
    user_input = input("Enter party size (default 4): ").strip()
    
    # If user just pressed Enter (empty string)
    if not user_input:
        return 4
    
    # Try to convert to number
    try:
        size = int(user_input)
        if 1 <= size <= 8:
            return size
        else:
            print("Party size must be 1-8. Using default of 4.")
            return 4
    except ValueError:
        print("Invalid input. Using default party size of 4.")
        return 4
    
def get_difficulty():
    """
    Prompts user to select encounter difficulty.
    Shows numbered menu for easy selection.
    
    Returns:
    - String: "trivial", "low", "moderate", "severe", or "extreme"
    """
    print("\nSelect encounter difficulty:")
    print("  1. Trivial (easy warm-up)")
    print("  2. Low (minor challenge)")
    print("  3. Moderate (standard encounter)")
    print("  4. Severe (serious threat)")
    print("  5. Extreme (potential TPK)")
    
    # List of difficulty names in order
    difficulties = ["trivial", "low", "moderate", "severe", "extreme"]
    
    while True:
        choice = input("\nEnter difficulty (1-5, default 3): ").strip()
        
        # Default to moderate if user presses Enter
        if not choice:
            return "moderate"
        
        # Check if they entered a number
        if choice.isdigit():
            choice_num = int(choice)
            if 1 <= choice_num <= 5:
                # Convert 1-5 to 0-4 index
                return difficulties[choice_num - 1]
        
        print("Invalid choice. Please enter 1-5.")

def select_encounter_template():
    """
    Prompts user to select a specific encounter template.
    Used when user wants a particular encounter structure.
    
    Returns:
    - Template key string (e.g., "boss_and_lackeys")
    """
    print("\nSelect encounter template:")
    print("  1. Boss and Lackeys (Severe, 120 XP)")
    print("  2. Boss and Lieutenant (Severe, 120 XP)")
    print("  3. Elite Enemies (Severe, 120 XP)")
    print("  4. Lieutenant and Lackeys (Moderate, 80 XP)")
    print("  5. Mated Pair (Moderate, 80 XP)")
    print("  6. Troop (Moderate, 80 XP)")
    print("  7. Mook Squad (Low, 60 XP)")
    
    # Template keys in order matching the menu
    template_keys = [
        "boss_and_lackeys",
        "boss_and_lieutenant",
        "elite_enemies",
        "lieutenant_and_lackeys",
        "mated_pair",
        "troop",
        "mook_squad"
    ]
    
    while True:
        choice = input("\nEnter template (1-7): ").strip()
        
        if choice.isdigit():
            choice_num = int(choice)
            if 1 <= choice_num <= 7:
                return template_keys[choice_num - 1]
        
        print("Invalid choice. Please enter 1-7.")

# Main program
if __name__ == "__main__":
    print("=" * 50)
    print("  PATHFINDER 2E GM TOOLKIT")
    print("=" * 50)

    # Load monster index and terrain mapping
    monster_index = load_monster_index()
    terrain_mapping = load_terrain_mapping()

    # Check if monster index loaded successfully
    if not monster_index:
        print("\nCannot run without monster index.")
        print("Please run 'python build_monster_index.py' first.")
        exit()
    
    print(f"Loaded {len(monster_index)} monsters")
    
    # Main menu loop
    while True:
        print("\n" + "=" * 50)
        print("What would you like to generate?")
        print("  1. NPC")
        print("  2. Random Encounter (quick)")
        print("  3. Custom Encounter (choose difficulty)")
        print("  4. Encounter from Template")
        print("  5. Both (NPC + Random Encounter)")
        print("  6. Exit")
        
        choice = input("\nEnter your choice (1-6): ").strip()
        
        if choice == "1":
            # Generate NPC
            print("\n" + "=" * 50)
            npc = generate_npc()
            print(npc)
        
        elif choice == "2":
            # Random Encounter - fastest option
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()
            
            print("\nGenerating random encounter...")
            encounter = generate_random_encounter(party_level, party_size, terrain, monster_index)
            print(encounter)
        
        elif choice == "3":
            # Custom Encounter - full control
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            difficulty = get_difficulty()
            terrain = get_valid_terrain()
            
            print("\nGenerating custom encounter...")
            encounter = generate_custom_encounter(party_level, party_size, difficulty, terrain, monster_index)
            print(encounter)
        
        elif choice == "4":
            # Template Encounter - specific structure
            print("\n" + "=" * 50)
            party_level = get_valid_number("Enter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()
            template_key = select_encounter_template()
            
            print("\nGenerating encounter from template...")
            encounter = generate_encounter_from_template(template_key, party_level, party_size, terrain, monster_index)
            print(encounter)
        
        elif choice == "5":
            # Both NPC and Random Encounter
            print("\n" + "=" * 50)
            npc = generate_npc()
            print(npc)
            
            party_level = get_valid_number("\nEnter party level (1-20): ", 1, 20)
            party_size = get_party_size()
            terrain = get_valid_terrain()
            
            print("\nGenerating random encounter...")
            encounter = generate_random_encounter(party_level, party_size, terrain, monster_index)
            print(encounter)
        
        elif choice == "6":
            # Exit
            print("\nThanks for using the GM Toolkit!")
            break
        
        else:
            print("\nInvalid choice. Please enter 1-6.")