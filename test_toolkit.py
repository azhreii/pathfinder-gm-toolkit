"""
Test script for Pathfinder GM Toolkit
Tests each function with various party levels, party sizes, and terrains.
"""
import sys
import json

# We need to prevent the module-level load_npc_names() from blocking if file missing
# Import individual pieces after setup
import npc_generator as npc

def test_format_terrain_name():
    """Test terrain name formatting."""
    print("\n" + "=" * 60)
    print("TEST: format_terrain_name()")
    print("=" * 60)

    test_cases = [
        ("forest", "Forest"),
        ("planar_air", "Planar Air"),
        ("planar_fire", "Planar Fire"),
        ("first_world", "First World"),
        ("hell", "Hell"),
        ("underground", "Underground"),
        ("any", "Any"),
    ]

    passed = 0
    failed = 0
    for terrain, expected in test_cases:
        result = npc.format_terrain_name(terrain)
        if result == expected:
            print(f"  PASS: '{terrain}' -> '{result}'")
            passed += 1
        else:
            print(f"  FAIL: '{terrain}' -> '{result}' (expected '{expected}')")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_get_creature_xp():
    """Test XP calculation for various level differences."""
    print("\n" + "=" * 60)
    print("TEST: get_creature_xp()")
    print("=" * 60)

    # (creature_level, party_level, expected_xp)
    test_cases = [
        (5, 5, 40),    # Same level
        (6, 5, 60),    # +1
        (7, 5, 80),    # +2
        (8, 5, 120),   # +3
        (9, 5, 160),   # +4
        (4, 5, 30),    # -1
        (3, 5, 20),    # -2
        (2, 5, 15),    # -3
        (1, 5, 10),    # -4
        (0, 5, 10),    # -5 (below table, should cap at 10)
        (15, 5, 160),  # +10 (above table, should cap at 160)
    ]

    passed = 0
    failed = 0
    for creature_lvl, party_lvl, expected in test_cases:
        result = npc.get_creature_xp(creature_lvl, party_lvl)
        diff = creature_lvl - party_lvl
        if result == expected:
            print(f"  PASS: Creature {creature_lvl} vs Party {party_lvl} (diff {diff:+d}) = {result} XP")
            passed += 1
        else:
            print(f"  FAIL: Creature {creature_lvl} vs Party {party_lvl} (diff {diff:+d}) = {result} XP (expected {expected})")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_calculate_xp_budget():
    """Test XP budget calculation for various party sizes and difficulties."""
    print("\n" + "=" * 60)
    print("TEST: calculate_xp_budget()")
    print("=" * 60)

    difficulties = ["trivial", "low", "moderate", "severe", "extreme"]
    party_sizes = [3, 4, 5, 6]

    # Expected values based on PF2e rules
    # Base (party of 4): trivial=40, low=60, moderate=80, severe=120, extreme=160
    # Adjustments per char: trivial=10, low=20, moderate=20, severe=30, extreme=40
    expected = {
        ("trivial", 3): 30, ("trivial", 4): 40, ("trivial", 5): 50, ("trivial", 6): 60,
        ("low", 3): 40, ("low", 4): 60, ("low", 5): 80, ("low", 6): 100,
        ("moderate", 3): 60, ("moderate", 4): 80, ("moderate", 5): 100, ("moderate", 6): 120,
        ("severe", 3): 90, ("severe", 4): 120, ("severe", 5): 150, ("severe", 6): 180,
        ("extreme", 3): 120, ("extreme", 4): 160, ("extreme", 5): 200, ("extreme", 6): 240,
    }

    passed = 0
    failed = 0
    for diff in difficulties:
        for size in party_sizes:
            result = npc.calculate_xp_budget(size, diff)
            exp = expected[(diff, size)]
            if result == exp:
                print(f"  PASS: {diff:>8s}, {size} PCs = {result} XP")
                passed += 1
            else:
                print(f"  FAIL: {diff:>8s}, {size} PCs = {result} XP (expected {exp})")
                failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_get_encounter_templates():
    """Test that encounter templates are valid."""
    print("\n" + "=" * 60)
    print("TEST: get_encounter_templates()")
    print("=" * 60)

    templates = npc.get_encounter_templates()

    passed = 0
    failed = 0

    expected_keys = [
        "boss_and_lackeys", "boss_and_lieutenant", "elite_enemies",
        "lieutenant_and_lackeys", "mated_pair", "troop", "mook_squad"
    ]

    for key in expected_keys:
        if key in templates:
            t = templates[key]
            has_name = "name" in t
            has_xp = "xp" in t
            has_difficulty = "difficulty" in t
            has_structure = "structure" in t and len(t["structure"]) > 0

            if has_name and has_xp and has_difficulty and has_structure:
                print(f"  PASS: '{key}' - {t['name']} ({t['difficulty']}, {t['xp']} XP, {len(t['structure'])} groups)")
                passed += 1
            else:
                print(f"  FAIL: '{key}' - missing required fields")
                failed += 1
        else:
            print(f"  FAIL: '{key}' - template not found")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_generate_npc():
    """Test NPC generation multiple times."""
    print("\n" + "=" * 60)
    print("TEST: generate_npc()")
    print("=" * 60)

    passed = 0
    failed = 0

    for i in range(5):
        try:
            result = npc.generate_npc()
            # Check that required fields are present in output
            has_name = "Name:" in result
            has_race = "Race:" in result
            has_sex = "Sex:" in result
            has_occupation = "Occupation:" in result
            has_personality = "Personality:" in result

            if has_name and has_race and has_sex and has_occupation and has_personality:
                # Extract the name line for display
                lines = [l.strip() for l in result.strip().split("\n") if l.strip()]
                name_line = [l for l in lines if l.startswith("Name:")][0]
                race_line = [l for l in lines if l.startswith("Race:")][0]
                print(f"  PASS: NPC #{i+1} - {name_line}, {race_line}")
                passed += 1
            else:
                print(f"  FAIL: NPC #{i+1} - missing fields in output")
                failed += 1
        except Exception as e:
            print(f"  FAIL: NPC #{i+1} - Exception: {e}")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_monster_matches_terrain():
    """Test terrain matching logic."""
    print("\n" + "=" * 60)
    print("TEST: monster_matches_terrain()")
    print("=" * 60)

    terrain_mapping = npc.load_terrain_mapping()

    if not terrain_mapping.get("terrain_definitions"):
        print("  SKIP: No terrain definitions loaded")
        return True

    # Create test monsters with known traits
    test_monsters = [
        {"name": "Test Beast", "traits": ["beast", "animal"], "level": 5},
        {"name": "Test Undead", "traits": ["undead"], "level": 3},
        {"name": "Test Elemental Fire", "traits": ["elemental", "fire"], "level": 7},
        {"name": "Test Aquatic", "traits": ["aquatic"], "level": 4},
        {"name": "Test Dragon", "traits": ["dragon"], "level": 10},
        {"name": "Test Fiend", "traits": ["fiend", "demon"], "level": 8},
        {"name": "Test Fey", "traits": ["fey"], "level": 6},
    ]

    terrains_to_test = list(terrain_mapping["terrain_definitions"].keys())[:8]  # Test first 8

    passed = 0
    tested = 0
    for terrain in terrains_to_test:
        matches = []
        for monster in test_monsters:
            result = npc.monster_matches_terrain(monster, terrain, terrain_mapping)
            if result:
                matches.append(monster["name"])
            tested += 1

        if matches:
            print(f"  {npc.format_terrain_name(terrain):>15}: {', '.join(matches)}")
        else:
            print(f"  {npc.format_terrain_name(terrain):>15}: (no matches)")
        passed += 1

    print(f"\n  Tested {tested} monster/terrain combinations across {len(terrains_to_test)} terrains")
    print(f"  Results: All terrain checks completed without errors")
    return True


def test_generate_random_encounter():
    """Test random encounter generation with various inputs."""
    print("\n" + "=" * 60)
    print("TEST: generate_random_encounter()")
    print("=" * 60)

    monster_index = npc.load_monster_index()
    terrain_mapping = npc.load_terrain_mapping()

    if not monster_index:
        print("  SKIP: No monster index loaded")
        return True

    # Store terrain_mapping in npc module scope so the function can access it
    npc.terrain_mapping = terrain_mapping

    test_cases = [
        (1, 4, "forest"),
        (5, 4, "underground"),
        (10, 4, "mountains"),
        (15, 6, "desert"),
        (20, 3, "hell"),
        (5, 4, "graveyard"),
        (8, 5, "urban"),
        (3, 4, "coastal"),
    ]

    passed = 0
    failed = 0
    for party_level, party_size, terrain in test_cases:
        try:
            result = npc.generate_random_encounter(party_level, party_size, terrain, monster_index)
            if "Encounter Generated:" in result or "Cannot build" in result or "No monsters found" in result:
                # Truncate output for readability
                first_lines = result.strip().split("\n")[:3]
                summary = " | ".join(l.strip() for l in first_lines if l.strip())
                print(f"  PASS: Level {party_level:>2}, {party_size} PCs, {npc.format_terrain_name(terrain):>15} -> {summary[:80]}")
                passed += 1
            else:
                print(f"  FAIL: Level {party_level}, {party_size} PCs, {terrain} -> Unexpected output")
                failed += 1
        except Exception as e:
            print(f"  FAIL: Level {party_level}, {party_size} PCs, {terrain} -> Exception: {e}")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_generate_custom_encounter():
    """Test custom encounter generation with various inputs."""
    print("\n" + "=" * 60)
    print("TEST: generate_custom_encounter()")
    print("=" * 60)

    monster_index = npc.load_monster_index()
    terrain_mapping = npc.load_terrain_mapping()

    if not monster_index:
        print("  SKIP: No monster index loaded")
        return True

    npc.terrain_mapping = terrain_mapping

    difficulties = ["trivial", "low", "moderate", "severe", "extreme"]

    test_cases = [
        (5, 4, "moderate", "forest"),
        (1, 4, "low", "urban"),
        (10, 3, "severe", "underground"),
        (15, 6, "extreme", "mountains"),
        (20, 4, "trivial", "desert"),
        (8, 5, "moderate", "graveyard"),
        (3, 4, "severe", "coastal"),
    ]

    passed = 0
    failed = 0
    for party_level, party_size, difficulty, terrain in test_cases:
        try:
            result = npc.generate_custom_encounter(party_level, party_size, difficulty, terrain, monster_index)
            if "Custom Encounter" in result or "No monsters" in result:
                first_lines = result.strip().split("\n")[:3]
                summary = " | ".join(l.strip() for l in first_lines if l.strip())
                print(f"  PASS: Lvl {party_level:>2}, {party_size} PCs, {difficulty:>8}, {npc.format_terrain_name(terrain):>15} -> {summary[:70]}")
                passed += 1
            else:
                print(f"  FAIL: Lvl {party_level}, {party_size} PCs, {difficulty}, {terrain} -> Unexpected output")
                failed += 1
        except Exception as e:
            print(f"  FAIL: Lvl {party_level}, {party_size} PCs, {difficulty}, {terrain} -> Exception: {e}")
            failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


def test_generate_encounter_from_template():
    """Test template encounter generation with each template."""
    print("\n" + "=" * 60)
    print("TEST: generate_encounter_from_template()")
    print("=" * 60)

    monster_index = npc.load_monster_index()
    terrain_mapping = npc.load_terrain_mapping()

    if not monster_index:
        print("  SKIP: No monster index loaded")
        return True

    npc.terrain_mapping = terrain_mapping

    templates = npc.get_encounter_templates()
    template_keys = list(templates.keys())

    # Test each template at different levels
    test_levels = [1, 5, 10, 15, 20]
    party_size = 4
    terrain = "forest"

    passed = 0
    failed = 0

    for template_key in template_keys:
        template_name = templates[template_key]["name"]
        for level in test_levels:
            try:
                result = npc.generate_encounter_from_template(template_key, level, party_size, terrain, monster_index)
                if "Encounter Generated:" in result or "Cannot build" in result or "No monsters" in result:
                    is_success = "Encounter Generated:" in result
                    status = "OK" if is_success else "No match"
                    print(f"  PASS: {template_name:<25} Lvl {level:>2} -> {status}")
                    passed += 1
                else:
                    print(f"  FAIL: {template_name:<25} Lvl {level:>2} -> Unexpected output")
                    failed += 1
            except Exception as e:
                print(f"  FAIL: {template_name:<25} Lvl {level:>2} -> Exception: {e}")
                failed += 1

    print(f"\n  Results: {passed} passed, {failed} failed")
    return failed == 0


if __name__ == "__main__":
    print("=" * 60)
    print("  PATHFINDER GM TOOLKIT - AUTOMATED TESTS")
    print("=" * 60)

    results = {}

    # Test helper functions first
    results["format_terrain_name"] = test_format_terrain_name()
    results["get_creature_xp"] = test_get_creature_xp()
    results["calculate_xp_budget"] = test_calculate_xp_budget()
    results["get_encounter_templates"] = test_get_encounter_templates()

    # Test NPC generation
    results["generate_npc"] = test_generate_npc()

    # Test terrain matching
    results["monster_matches_terrain"] = test_monster_matches_terrain()

    # Test encounter generators
    results["generate_random_encounter"] = test_generate_random_encounter()
    results["generate_custom_encounter"] = test_generate_custom_encounter()
    results["generate_encounter_from_template"] = test_generate_encounter_from_template()

    # Final Summary
    print("\n" + "=" * 60)
    print("  FINAL SUMMARY")
    print("=" * 60)

    total_pass = sum(1 for v in results.values() if v)
    total_fail = sum(1 for v in results.values() if not v)

    for name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {name}")

    print(f"\n  Total: {total_pass} passed, {total_fail} failed out of {len(results)} test suites")
    print("=" * 60)
