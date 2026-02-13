# Pathfinder GM Toolkit - NPC and Encounter Generator Version 0.1
import json
import random

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
        exit()00

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


#Monster Database - Each monster is a dictionary with stats
monsters = [
    {
        "name": "Goblin Warrior",
        "cr": 1,
        "hp": 6,
        "ac": 15,
        "type": "Humanoid",
        "terrain": ["forest", "hills", "ruins"]
    },
    {
        "name": "Zombie",
        "cr": 1,
        "hp": 20,
        "ac": 15,
        "type": "undead",
        "terrain": ["ruins", "graveyard", "dungeoun"]
    },
    {
        "name": "Dire Wolf",
        "cr": 3,
        "hp": 42,
        "ac": 14,
        "type": "animal",
        "terrain": ["forest", "tundra", "mountains"]
    },
    {
        "name": "Young Black Dragon",
        "cr": 7,
        "hp": 127,
        "ac": 18,
        "type": "dragon",
        "terrain": ["ruins", "forest", "swamp"]
    },
    {
        "name": "Owlbear",
        "cr": 3,
        "hp": 60,
        "ac": 15,
        "type": "beast",
        "terrain": ["forest", "hills"]        
    },
    {
        "name": "Bandit",
        "cr": 1,
        "hp": 11,
        "ac": 14,
        "type": "humanoid",
        "terrain": ["road", "forest", "ruins"]
    }

]
#Available Terrain types
terrain_types = [
    "forest",
    "hills",
    "mountains",
    "dungeon",
    "swamp",
    "ruins",
    "graveyard",
    "road",
    "tundra"
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
    - Valie terrain string (lowercase)
    """
    print("\nAvailable terrains:")
    # Display all terrain options with numbers for easy selection
    for i, terrain in enumerate(terrain_types):
        print(f" {i + 1}. {terrain.capitalize()}")
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
            
#Main Program - this runs when you execute the file
if __name__ == "__main__":
    print("=" * 40)
    print(" Pathfinder GM TOOLKIT ")
    print("=" * 40)

    # Main menu loop
    while True:
        print("\nWhat would you like to generate?")
        print(" 1. NPC")
        print(" 2. Encounter")
        print(" 3. Both")
        print(" 4. Exit")

        choice = input("\nEnter your choice (1-4): ").strip()

        if choice == "1":
            # Generate NPC
            print("\n" + "=" * 40)
            npc = generate_npc()
            print(npc)

        elif choice == "2":
            # Generate Encounter
            print("\n" + "=" * 40)
            party_level = get_valid_number("Enter average party level (1-20): ", 1, 20)
            terrain = get_valid_terrain()
            
            print("\nGenerating encounter...")
            encounter = generate_encounter(party_level, terrain)
            print(encounter)

        elif choice == "3":
            # Generate Both
            print("\n" + "=" * 40)
            npc = generate_npc()
            print(npc)

            party_level = get_valid_number("Enter party level (1-20): ",1 , 20)
            terrain = get_valid_terrain()

            print("\nGenerating encounter...")
            encounter = generate_encounter(party_level, terrain)
            print(encounter)

        elif choice == "4":
            # Exit the program
            print("\nThanks for using the GM Toolkit! Goodbye!")
            break

        else:
            print("\nInvalid Choice. Please enter a 1, 2, 3, or 4.")
            