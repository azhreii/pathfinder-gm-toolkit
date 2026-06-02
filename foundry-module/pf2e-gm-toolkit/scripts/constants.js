/**
 * Shared constants for the PF2e GM Toolkit.
 * Ported from constants.py — same data, same structure.
 */

const GMTOOLKIT = {};

GMTOOLKIT.TERRAIN_TYPES = [
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
];

/* Human-readable labels for terrain dropdown menus. */
GMTOOLKIT.TERRAIN_LABELS = {
  forest: "Forest",
  urban: "Urban",
  underground: "Underground",
  aquatic: "Aquatic",
  coastal: "Coastal",
  mountains: "Mountains",
  desert: "Desert",
  arctic: "Arctic",
  planar_air: "Planar (Air)",
  planar_earth: "Planar (Earth)",
  planar_fire: "Planar (Fire)",
  planar_water: "Planar (Water)",
  graveyard: "Graveyard",
  astral: "Astral",
  ethereal: "Ethereal",
  hell: "Hell",
  abyss: "Abyss",
  heaven: "Heaven",
  shadow: "Shadow",
  first_world: "First World",
  any: "Any",
};

GMTOOLKIT.OCCUPATIONS = [
  "Blacksmith", "Merchant", "Guard", "Innkeeper", "Farmer",
  "Bard", "Alchemist", "Healer", "Thief", "Noble",
  "Sailor", "Hunter", "Priest", "Scholar", "Carpenter",
  "Tailor", "Fisherman", "Miner", "Cook", "Apothecary",
  /* Extended list — added for NPC purpose filtering */
  "Mercenary", "Bounty Hunter", "Soldier", "Bodyguard", "Pit Fighter",
  "Armorer", "Jeweler", "Weaponsmith", "Herbalist", "Provisioner",
  "Smuggler", "Fence", "Spy", "Assassin", "Crime Lord",
  "Diplomat", "Noble's Aide", "Tax Collector", "Magistrate",
  "Acolyte", "Oracle", "Sage", "Scribe", "Archivist",
  "Stablehand", "Dockworker", "Lumberjack", "Quarryman", "Street Vendor",
];

/**
 * NPC Purpose — drives occupation pool and archetype category pre-filter.
 * Each entry: { label, occupations: string[], archetypeCategory: string|null,
 *               autoMerchant: boolean }
 * archetypeCategory must match keys used in actor-creator.js classification:
 *   'Combatant' | 'Spellcaster' | 'Specialist' | 'Non-combatant' | null (= All)
 */
GMTOOLKIT.NPC_PURPOSES = {
  any: {
    label: "Any",
    occupations: null,           /* null = use full OCCUPATIONS list */
    archetypeCategory: null,
    autoMerchant: false,
  },
  combat: {
    label: "Combat / Guard",
    occupations: ["Guard", "Mercenary", "Bounty Hunter", "Soldier", "Bodyguard",
                  "Pit Fighter", "Hunter"],
    archetypeCategory: "Combatant",
    autoMerchant: false,
  },
  merchant: {
    label: "Merchant / Trader",
    occupations: ["Merchant", "Blacksmith", "Armorer", "Weaponsmith", "Alchemist",
                  "Herbalist", "Apothecary", "Tailor", "Carpenter", "Cook",
                  "Jeweler", "Innkeeper", "Provisioner", "Street Vendor"],
    archetypeCategory: "Non-combatant",
    autoMerchant: true,          /* triggers merchant mode automatically */
  },
  noble: {
    label: "Noble / Political",
    occupations: ["Noble", "Diplomat", "Noble's Aide", "Tax Collector", "Magistrate",
                  "Bard"],
    archetypeCategory: "Non-combatant",
    autoMerchant: false,
  },
  scholar: {
    label: "Scholar / Sage",
    occupations: ["Scholar", "Sage", "Scribe", "Archivist", "Healer", "Alchemist",
                  "Bard"],
    archetypeCategory: "Specialist",
    autoMerchant: false,
  },
  spiritual: {
    label: "Spiritual / Clergy",
    occupations: ["Priest", "Acolyte", "Oracle", "Healer"],
    archetypeCategory: "Spellcaster",
    autoMerchant: false,
  },
  criminal: {
    label: "Criminal / Underworld",
    occupations: ["Thief", "Smuggler", "Fence", "Spy", "Assassin", "Crime Lord",
                  "Bounty Hunter"],
    archetypeCategory: "Combatant",
    autoMerchant: false,
  },
  commoner: {
    label: "Commoner / Laborer",
    occupations: ["Farmer", "Sailor", "Fisherman", "Miner", "Carpenter",
                  "Stablehand", "Dockworker", "Lumberjack", "Quarryman", "Cook"],
    archetypeCategory: "Non-combatant",
    autoMerchant: false,
  },
};

GMTOOLKIT.PERSONALITY_TRAITS = [
  "Brave", "Cautious", "Curious", "Friendly", "Grumpy",
  "Honest", "Loyal", "Mysterious", "Optimistic", "Pessimistic",
  "Reckless", "Shy", "Skeptical", "Trusting", "Witty",
  "Suspicious of outsiders", "Overly cheerful", "Speaks in riddles",
  "Has a nervous tic", "Always hungry", "Obsessed with cleanliness",
  "Tells bad jokes", "Unnaturally calm", "Rude", "Sarcastic",
];

GMTOOLKIT.DIFFICULTIES = ["trivial", "low", "moderate", "severe", "extreme"];

GMTOOLKIT.DIFFICULTY_LABELS = {
  trivial: "Trivial (easy warm-up)",
  low: "Low (minor challenge)",
  moderate: "Moderate (standard encounter)",
  severe: "Severe (serious threat)",
  extreme: "Extreme (potential TPK)",
};

GMTOOLKIT.ENCOUNTER_TEMPLATES = {
  boss_and_lackeys:        "Boss and Lackeys (Severe, 120 XP)",
  boss_and_lieutenant:     "Boss and Lieutenant (Severe, 120 XP)",
  elite_enemies:           "Elite Enemies (Severe, 120 XP)",
  lieutenant_and_lackeys:  "Lieutenant and Lackeys (Moderate, 80 XP)",
  mated_pair:              "Mated Pair (Moderate, 80 XP)",
  troop:                   "Troop (Moderate, 80 XP)",
  mook_squad:              "Mook Squad (Low, 60 XP)",
};

/* ------------------------------------------------------------------ */
/* LLM / AI provider constants                                         */
/* ------------------------------------------------------------------ */

/**
 * Display labels for each supported AI provider.
 * Keyed by the value stored in the llmProvider setting.
 */
GMTOOLKIT.LLM_PROVIDERS = {
  gemini:             "Google Gemini",
  openai:             "OpenAI",
  mistral:            "Mistral",
  "openai-compatible": "Custom (OpenAI-compatible)",
};

/**
 * Default model name for each provider.
 * Used when the llmModel setting is left blank.
 * openai-compatible has no sensible universal default, so it stays empty
 * and the user is expected to supply a value in the Model field.
 */
GMTOOLKIT.DEFAULT_MODELS = {
  gemini:             "gemini-2.5-flash",
  openai:             "gpt-4o",
  mistral:            "mistral-large-latest",
  "openai-compatible": "",
};

/* ------------------------------------------------------------------ */
/* Boss-pinning constants                                               */
/* ------------------------------------------------------------------ */

/**
 * Traits that are too generic to use as a meaningful trait-intersection
 * filter when regenerating supporting creatures around a pinned boss.
 * Any trait in this set is ignored during the "shares a trait" check so
 * that nearly every creature in the index isn't considered a match.
 */
GMTOOLKIT.BOSS_PIN_GENERIC_TRAITS = new Set([
  "humanoid",
  "common",
  "medium",
  "small",
  "large",
  "huge",
  "tiny",
  "mindless",
  "evil",
  "good",
  "lawful",
  "chaotic",
  "creature",
  "extraplanar",
  "cold-blooded",
]);

/* ------------------------------------------------------------------ */
/* Item compendium index constants                                      */
/* ------------------------------------------------------------------ */

/**
 * Canonical category keys for the item index.
 * Used as both storage keys and filter arguments to getItemsForShop().
 * The values here are the keys themselves — the object is used for
 * enumeration and quick membership checks (Object.keys, hasOwnProperty).
 */
GMTOOLKIT.ITEM_CATEGORIES = {
  weapon:     "weapon",
  armor:      "armor",
  consumable: "consumable",
  alchemical: "alchemical",
  magical:    "magical",
  adventuring: "adventuring",
  treasure:   "treasure",
};

/** Human-readable display labels for each item category key. */
GMTOOLKIT.ITEM_CATEGORY_LABELS = {
  weapon:     "Weapons",
  armor:      "Armor & Shields",
  consumable: "Consumables",
  alchemical: "Alchemical Items",
  magical:    "Magical Items",
  adventuring: "Adventuring Gear",
  treasure:   "Treasure",
};

/* ------------------------------------------------------------------ */
/* Hazard compendium index constants                                    */
/* ------------------------------------------------------------------ */

/**
 * Maps each terrain key to an array of PF2e trait strings.
 * A hazard is associated with a terrain if any of its traits appear in
 * that terrain's list. A hazard matching no terrain is assigned ['any'].
 *
 * Terrain keys deliberately overlap with GMTOOLKIT.TERRAIN_TYPES where
 * possible (forest, urban, aquatic, desert, arctic) but this mapping is
 * intentionally simpler — it covers only the terrain types for which
 * hazard trait inference is meaningful.
 */
GMTOOLKIT.HAZARD_TERRAIN_TRAITS = {
  forest:    ["plant", "fungus", "wood"],
  dungeon:   ["trap", "constructed"],
  aquatic:   ["water", "aquatic"],
  mountain:  ["earth", "stone", "rock"],
  urban:     ["trap", "constructed", "mechanical"],
  underdark: ["fungus", "darkness", "void"],
  plains:    ["plant", "earth"],
  desert:    ["fire", "earth", "sand"],
  swamp:     ["water", "plant", "fungus"],
  arctic:    ["cold", "ice"],
};

/** Human-readable display labels for hazard category keys. */
GMTOOLKIT.HAZARD_CATEGORY_LABELS = {
  trap:          "Trap",
  environmental: "Environmental",
  magical:       "Magical",
};

/* ------------------------------------------------------------------ */
/* Shop system constants                                                */
/* ------------------------------------------------------------------ */

/**
 * Canonical shop type keys for the merchant / shop system.
 * Values are human-readable labels — the keys are used internally as
 * filter arguments to generateShopInventory() and inferShopType().
 */
GMTOOLKIT.SHOP_TYPES = {
  general:    "General Store",
  weapon:     "Weapon Shop",
  armor:      "Armor & Shield Shop",
  alchemical: "Alchemist / Herbalist",
  magical:    "Magic Emporium",
  consumable: "Apothecary / Provisions",
  specialty:  "Specialty / Curio",
};

/**
 * Alias for SHOP_TYPES provided for consistency with the ITEM_CATEGORY_LABELS
 * / TERRAIN_LABELS naming convention elsewhere in this file.
 */
GMTOOLKIT.SHOP_TYPE_LABELS = GMTOOLKIT.SHOP_TYPES;
