"""
Monster Index Builder for Pathfinder 2e Foundry VTT Data

This script scans Foundry Vtt monster JSON files and builds a lightweight index for quick encounter generation.

Usage:
    python build_monster_index.py
"""

import os
import json

def build_monster_index_from_folder(folder_path):
    """
    Scans a folder (and subfolders) of Foundry monster JSON files and extracts key data.
    
    Parameters:
    - folder_path: Path to the folder containing monster JSON files
    
    Returns:
    - List of monster dictionaries with extracted data
    """
    monsters = []
    
    # Check if folder exists
    if not os.path.exists(folder_path):
        print(f"  WARNING: Folder not found: {folder_path}")
        return []
    
    # Walk through the directory tree (includes subdirectories)
    for root, dirs, files in os.walk(folder_path):
        # Process each file in the current directory
        for filename in files:
            # Only process JSON files
            if not filename.endswith('.json'):
                continue
            
            # Build full file path
            file_path = os.path.join(root, filename)
            
            try:
                # Open and read the JSON file
                with open(file_path, 'r', encoding='utf-8') as file:
                    data = json.load(file)
                
                # Extract the data we need
                monster = {
                    "name": data.get("name", "Unknown"),
                    "level": data.get("system", {}).get("details", {}).get("level", {}).get("value", 0),
                    "hp": data.get("system", {}).get("attributes", {}).get("hp", {}).get("max", 0),
                    "ac": data.get("system", {}).get("attributes", {}).get("ac", {}).get("value", 0),
                    "traits": data.get("system", {}).get("traits", {}).get("value", []),
                    "rarity": data.get("system", {}).get("traits", {}).get("rarity", "common"),
                    "size": data.get("system", {}).get("traits", {}).get("size", {}).get("value", "med"),
                    "remaster": data.get("system", {}).get("details", {}).get("publication", {}).get("remaster", False),
                    "source": data.get("system", {}).get("details", {}).get("publication", {}).get("title", "Unknown"),
                    "file_path": file_path
                }
                
                # Only add if it has a name and level (filter out junk data)
                if monster["name"] != "Unknown" and monster["level"] > 0:
                    monsters.append(monster)
            
            except json.JSONDecodeError:
                # If JSON is malformed, skip this file
                continue
            except Exception as e:
                # Catch any other errors and skip
                continue
    
    return monsters

def scan_multiple_folders(base_path, folder_names):
    """
    Scans multiple bestiary folders and combines the results.

    Parameters:
    - base_path: Base directory containing all the folders
    - folder_names: List of folder names to scan

    Returns:
    - Combined list of all monsters from all folders
    """
    all_monsters = []

    print(f"Scanning {len(folder_names)} folders...")
    print("="*60)

    for folder_name in folder_names:
        folder_path = os.path.join(base_path, folder_name)

        print(f"\nScanning: {folder_name}")

        monsters = build_monster_index_from_folder(folder_path)

        if monsters:
            print(f" Found {len(monsters)} monsters")
            all_monsters.extend(monsters)
        else:
            print(f" No Monsters Found")

    return all_monsters

def analyze_all_traits(monsters):
    """
    Analyzes all monsters and returns a set of unique traits.
    
    Parameters:
    - monsters: List of monster dictionaries
    
    Returns:
    - Sorted list of unique trait strings
    """
    all_traits = set()
    
    for monster in monsters:
        traits = monster.get("traits", [])
        for trait in traits:
            all_traits.add(trait)
    
    return sorted(all_traits)

def save_monster_index(monsters, output_file="monster_index.json"):
    """
    Saves the monster index to a json file

    Parameters:
    - monsters: List of monster dictionaries
    - output_file: Filename to save to 
    """

    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(monsters, file, indent=2)
        print(f"Monster index saved to {output_file}")
        print (f"Total Monsters: {len(monsters)}")

    except Exception as e:
        print(f"\n Error: could not save index file: {e}")

def save_traits_lists(traits, output_file="all_traits.txt"):
    """
    Saves the list of unique traits to a text file for reference.

    Parameters:
    - traits: List of trait strings
    -output_file: Filename to save to
    """
    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            file.write(f"Total unique traits: {len(traits)}\n")
            file.write("="*60 + "\n\n")
            for trait in traits:
                file.write(f"{trait}\n")
    except Exception as e:
        print(f"x Error: Could not save traits file: {e}")

# Main Execution
if __name__ == "__main__":
    print("="*60)
    print("PATHFINDER 2E MONSTER INDEX BUILDER")
    print("="*60)

    # Base path to local foundry data
    BASE_PATH = r"C:\Users\todmo\source\repos\pf2e\packs\pf2e" 

    # List of folders to scan
    # Start with core books, add more as needed
    FOLDERS_TO_SCAN = [
    # Remaster Core (priority)
    "pathfinder-monster-core",
    "pathfinder-monster-core-2",
    
    # Original Bestiaries
    "pathfinder-bestiary",
    "pathfinder-bestiary-2",
    "pathfinder-bestiary-3",
    
    # NPCs and Other Core
    "pathfinder-npc-core",
    "npc-gallery",
    
    # Lost Omens and Supplemental
    "lost-omens-bestiary",
    "book-of-the-dead-bestiary",
    "rage-of-elements-bestiary",
    "howl-of-the-wild-bestiary",
    "pathfinder-dark-archive",
    "war-of-immortals-bestiary",
    
    # Adventure Paths (alphabetical)
    "abomination-vaults-bestiary",
    "age-of-ashes-bestiary",
    "agents-of-edgewatch-bestiary",
    "battlecry-bestiary",
    "blood-lords-bestiary",
    "claws-of-the-tyrant-bestiary",
    "crown-of-the-kobold-king-bestiary",
    "curtain-call-bestiary",
    "extinction-curse-bestiary",
    "fists-of-the-ruby-phoenix-bestiary",
    "gatewalkers-bestiary",
    "kingmaker-bestiary",
    "outlaws-of-alkenstar-bestiary",
    "quest-for-the-frozen-flame-bestiary",
    "revenge-of-the-runelords-bestiary",
    "season-of-ghosts-bestiary",
    "seven-dooms-for-sandpoint-bestiary",
    "sky-kings-tomb-bestiary",
    "stolen-fate-bestiary",
    "strength-of-thousands-bestiary",
    "the-enmity-cycle-bestiary",
    "triumph-of-the-tusk-bestiary",
    "wardens-of-wildwood-bestiary",
    
    # Standalone Adventures
    "fall-of-plaguestone",
    "malevolence-bestiary",
    "menace-under-otari-bestiary",
    "night-of-the-gray-death-bestiary",
    "one-shot-bestiary",
    "prey-for-death-bestiary",
    "rusthenge-bestiary",
    "shades-of-blood-bestiary",
    "shadows-at-sundown-bestiary",
    "the-slithering-bestiary",
    "troubles-in-otari-bestiary",
    "spore-war-bestiary",
    "myth-speaker-bestiary",
    
    # Blog and Miscellaneous
    "blog-bestiary",
    
    # Pathfinder Society Seasons
    "pfs-introductions-bestiary",
    "pfs-season-1-bestiary",
    "pfs-season-2-bestiary",
    "pfs-season-3-bestiary",
    "pfs-season-4-bestiary",
    "pfs-season-5-bestiary",
    "pfs-season-6-bestiary",
    "pfs-season-7-bestiary",
]

    # Scan All Folders
    all_monsters = scan_multiple_folders(BASE_PATH, FOLDERS_TO_SCAN)

    print("\n" + "="*60)
    print(f"SCANNING COMPLETE")
    print("="*60)
    print(f"Total monsters indexed: {len(all_monsters)}")

    # Save the monster index
    save_monster_index(all_monsters)

    # Analyze and save unique traits
    print("\nAnalyzing traits...")
    unique_traits = analyze_all_traits(all_monsters)
    save_traits_lists(unique_traits)
    print(f"Found {len(unique_traits)} unique traits")

    print("\n" + "="*60)
    print("DONE!")
    print("="*60)
    print("\nYou can now use monster_index.json in your GM toolkit.")
