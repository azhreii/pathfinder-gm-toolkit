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
];

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
  gemini:             "gemini-2.0-flash",
  openai:             "gpt-4o",
  mistral:            "mistral-large-latest",
  "openai-compatible": "",
};
