/**
 * NPC generation logic. Ported from npc_logic.py.
 * Returns structured data objects rather than formatted strings so the UI
 * can render them however it likes.
 */

/** Pick a random element from an array. */
function _npcRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Turn an internal race key into a display name.
 * Matches Python's _get_race_display_name().
 * @param {string} raceKey
 * @param {object} raceData  entry from npc_names.json
 */
GMTOOLKIT.getRaceDisplayName = function (raceKey, raceData) {
  if (raceData.display_name) return raceData.display_name;
  if (raceKey.includes("_")) {
    const [first, second] = raceKey.split("_");
    return `${first.charAt(0).toUpperCase() + first.slice(1)} (${second.charAt(0).toUpperCase() + second.slice(1)})`;
  }
  return raceKey.charAt(0).toUpperCase() + raceKey.slice(1);
};

/**
 * Generate a basic NPC (no AI). Returns a plain object with the NPC fields.
 * @param {object} namesData        contents of npc_names.json
 * @param {string[]|null} [occupationPool]  optional filtered list of occupations;
 *                                          pass null/undefined to use the full list
 */
GMTOOLKIT.generateBasicNPC = function (namesData, occupationPool) {
  const races = Object.keys(namesData);
  if (races.length === 0) return null;

  const raceKey = _npcRandom(races);
  const raceData = namesData[raceKey];
  const sex = _npcRandom(["male", "female"]);

  const firstName = _npcRandom(raceData[sex]);
  const surname = _npcRandom(raceData.surnames);
  const race = GMTOOLKIT.getRaceDisplayName(raceKey, raceData);

  /* Use the provided occupation pool, or fall back to the full list.
     Guard against an empty pool so generation never returns null. */
  const pool = (occupationPool && occupationPool.length > 0)
    ? occupationPool
    : GMTOOLKIT.OCCUPATIONS;

  return {
    name: `${firstName} ${surname}`,
    race,
    sex: sex.charAt(0).toUpperCase() + sex.slice(1),
    occupation: _npcRandom(pool),
    personality: _npcRandom(GMTOOLKIT.PERSONALITY_TRAITS),
    /* These fields are null for basic NPCs; AI fills them. */
    appearance: null,
    motivation: null,
    secret: null,
    quote: null,
    aiEnhanced: false,
  };
};

/**
 * Merge AI-generated details onto an existing basic NPC object.
 * @param {object} npc     object returned by generateBasicNPC
 * @param {object} aiData  object returned by GMTOOLKIT.enhanceNPCWithAI
 */
GMTOOLKIT.applyAIEnhancement = function (npc, aiData) {
  return {
    ...npc,
    appearance: aiData.appearance ?? null,
    personality: aiData.personality ?? npc.personality,
    occupation: aiData.occupation ?? npc.occupation,
    motivation: aiData.motivation ?? null,
    secret: aiData.secret ?? null,
    quote: aiData.quote ?? null,
    aiEnhanced: true,
  };
};
