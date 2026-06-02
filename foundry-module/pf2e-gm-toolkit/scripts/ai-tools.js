/**
 * Google Gemini AI helpers. Ported from ai_tools.py.
 * Calls the Gemini REST API directly from the browser using fetch().
 * The API key is read from Foundry module settings at call time.
 */

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Get the stored Gemini API key. Returns null if not set.
 */
GMTOOLKIT.getGeminiKey = function () {
  try {
    return game.settings.get("pf2e-gm-toolkit", "geminiApiKey") || null;
  } catch {
    return null;
  }
};

/**
 * Strip markdown code fences that Gemini sometimes wraps JSON in.
 * Matches Python's _clean_json_response().
 */
function _cleanJsonResponse(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Call the Gemini generateContent endpoint and parse the JSON response.
 * Returns the parsed object, or throws on network/parse failure.
 */
async function _callGemini(prompt, apiKey) {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return JSON.parse(_cleanJsonResponse(raw));
}

/**
 * Ask Gemini for richer NPC details. Returns an object with appearance,
 * personality, occupation, motivation, secret, quote — or null on failure.
 *
 * @param {string} name
 * @param {string} race
 * @param {string} sex
 */
GMTOOLKIT.enhanceNPCWithAI = async function (name, race, sex) {
  const apiKey = GMTOOLKIT.getGeminiKey();
  if (!apiKey) return null;

  const prompt = `You are a Pathfinder 2e game master creating a memorable NPC.

Given this basic information:
- Name: ${name}
- Race: ${race}
- Sex: ${sex}

Generate detailed narrative content for this NPC. Respond ONLY with valid JSON in this exact format:
{
  "appearance": "2-3 sentence physical description",
  "personality": "2-3 sentence personality description with a distinctive quirk or mannerism",
  "occupation": "a specific occupation that fits this character",
  "motivation": "their primary goal or driving force",
  "secret": "an interesting secret or hidden aspect",
  "quote": "a memorable thing they might say"
}

Make the NPC interesting and memorable. Be specific and creative.`;

  try {
    return await _callGemini(prompt, apiKey);
  } catch (err) {
    console.warn("PF2e GM Toolkit | NPC AI enhancement failed:", err.message);
    return null;
  }
};

/**
 * Ask Gemini for encounter narrative. Returns an object with setting_description,
 * monster_description, encounter_hook, tactical_notes, battle_map_details — or null.
 *
 * @param {string} terrain
 * @param {string} templateName
 * @param {Array}  monsters  [{name, level}, ...]
 */
GMTOOLKIT.enhanceEncounterWithAI = async function (terrain, templateName, monsters) {
  const apiKey = GMTOOLKIT.getGeminiKey();
  if (!apiKey) return null;

  const terrainLabel = GMTOOLKIT.TERRAIN_LABELS[terrain] ?? terrain;
  const monsterList = monsters.map((m) => `- ${m.name} (Level ${m.level})`).join("\n");

  const prompt = `You are a Pathfinder 2e game master creating a memorable combat encounter.

Given this encounter setup:
Terrain: ${terrainLabel}
Encounter Type: ${templateName}
Monsters:
${monsterList}

Generate vivid narrative content for this encounter. Respond ONLY with valid JSON in this exact format, no other text:
{
  "setting_description": "3-5 sentence vivid description of the environment and atmosphere",
  "monster_description": "3-5 sentences describing what the monsters look like and how they're positioned/behaving",
  "encounter_hook": "Why are these creatures here? What's the situation the party is walking into?",
  "tactical_notes": "1-2 interesting terrain features or tactical elements that make this fight memorable",
  "battle_map_details": "Specific battle map setup: approximate dimensions (e.g., 30x40 feet), key terrain features and their positions, elevation changes, cover locations, and suggested monster starting positions."
}

Make it atmospheric and specific to the terrain and creatures. Avoid generic descriptions.`;

  try {
    return await _callGemini(prompt, apiKey);
  } catch (err) {
    console.warn("PF2e GM Toolkit | Encounter AI enhancement failed:", err.message);
    return null;
  }
};
