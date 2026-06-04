/**
 * Shop / Merchant Logic — PF2e GM Toolkit
 *
 * Provides three public functions on the GMTOOLKIT global:
 *   - inferShopType(occupation)            Keyword-based shop type detector
 *   - generateShopInventory(...)           Weighted random inventory builder
 *   - generateSpecialtyItem(...)           AI specialty item generator (async)
 *
 * Load order (module.json): after storage.js, before actor-creator.js.
 * Depends on: GMTOOLKIT.SHOP_TYPES (constants.js), GMTOOLKIT.getItemsForShop (storage.js).
 * The AI path also depends on GMTOOLKIT.isAIEnabled and GMTOOLKIT.callLLM (ai-tools.js).
 */

/* ------------------------------------------------------------------ */
/* Internal: keyword -> shop type mapping table                         */
/* ------------------------------------------------------------------ */

/*
 * Each entry is: { keywords: [...], type: 'shopTypeKey' }
 * Rules are checked in order — first match wins.
 * Compound words (weaponsmith, blacksmith) are checked before single-word
 * synonyms so "smith" doesn't accidentally match before "weaponsmith" does.
 */
var _SHOP_TYPE_KEYWORDS = [
  /* Weapon-making crafts — checked before generic "smith" */
  { keywords: ["weaponsmith", "bladesmith", "swordsmith", "bowyer", "fletcher"], type: "weapon" },
  /* Armor-making crafts */
  { keywords: ["armorer", "armourer", "blacksmith", "shieldwright"], type: "armor" },
  /* Alchemical / herbal */
  { keywords: ["herbalist", "apothecary", "alchemist", "herbmaster", "botanist", "potion"], type: "alchemical" },
  /* Magical / arcane */
  { keywords: ["wizard", "sage", "enchanter", "enchantress", "spellcaster", "mage",
               "artificer", "runesmith", "scrivener", "scrollmonger", "occultist"], type: "magical" },
  /* Innkeepers and food/drink vendors sell consumable provisions */
  { keywords: ["innkeeper", "tavernkeeper", "tavern", "brewer", "vintner",
               "baker", "cook", "provisioner", "grocer", "chandler"], type: "consumable" },
  /* Jewelers and curio dealers */
  { keywords: ["jeweler", "jeweller", "antiquarian", "curio", "collector",
               "curiosity", "pawnbroker", "relic"], type: "specialty" },
  /* General-purpose merchants — checked last so more-specific rules win */
  { keywords: ["merchant", "trader", "shopkeeper", "general", "vendor",
               "peddler", "tradesman", "tradeswoman", "hawker"], type: "general" },
];

/* ------------------------------------------------------------------ */
/* inferShopType                                                         */
/* ------------------------------------------------------------------ */

/**
 * Infer a shop type from an NPC's occupation string.
 *
 * Lowercases the occupation, then scans each keyword rule in priority order.
 * Returns the first matching SHOP_TYPES key, or null if no keyword matches.
 * The caller (npc-app.js _onEnableMerchant) defaults to 'general' on null.
 *
 * @param {string} occupation
 * @returns {string|null}  A key from GMTOOLKIT.SHOP_TYPES, or null
 */
GMTOOLKIT.inferShopType = function (occupation) {
  if (!occupation || typeof occupation !== "string") return null;

  var lower = occupation.toLowerCase();

  for (var i = 0; i < _SHOP_TYPE_KEYWORDS.length; i++) {
    var rule = _SHOP_TYPE_KEYWORDS[i];
    for (var j = 0; j < rule.keywords.length; j++) {
      if (lower.indexOf(rule.keywords[j]) !== -1) {
        return rule.type;
      }
    }
  }

  return null;
};

/* ------------------------------------------------------------------ */
/* Internal: weighted category draw helper                              */
/* ------------------------------------------------------------------ */

/**
 * Build a flat category draw list from a weight map.
 * Each category key appears N times proportional to its weight percentage,
 * giving a simple weighted random draw via array index.
 *
 * E.g. { weapon: 60, armor: 20, adventuring: 20 } with scale=10
 * produces: ["weapon","weapon",...×6, "armor","armor",×2, "adventuring","adventuring"×2]
 *
 * We use integer percentages and divide by 10 to keep the array at ≤10 entries
 * per category (max 100 entries total for 100% distribution).
 *
 * @param {object} weights  { categoryKey: percentInt, ... }
 * @returns {string[]}
 */
function _buildWeightedDrawList(weights) {
  var list = [];
  var keys = Object.keys(weights);
  for (var i = 0; i < keys.length; i++) {
    var cat   = keys[i];
    /* Divide percent by 10 so 100% → 10 slots, keeping the array manageable */
    var slots = Math.round(weights[cat] / 10);
    for (var s = 0; s < slots; s++) {
      list.push(cat);
    }
  }
  return list;
}

/*
 * Category weight tables by shop type (percentages must sum to 100).
 * Keys must match GMTOOLKIT.ITEM_CATEGORIES values.
 */
var _SHOP_CATEGORY_WEIGHTS = {
  weapon:     { weapon: 60, armor: 20, adventuring: 20 },
  armor:      { armor: 60, weapon: 20, adventuring: 20 },
  alchemical: { alchemical: 70, consumable: 20, adventuring: 10 },
  magical:    { magical: 50, consumable: 30, specialty: 20 },
  consumable: { consumable: 60, alchemical: 20, adventuring: 20 },
  general:    { weapon: 25, armor: 25, consumable: 25, adventuring: 25 },
  specialty:  { magical: 40, treasure: 30, specialty: 30 },
};

/* ------------------------------------------------------------------ */
/* generateShopInventory                                                 */
/* ------------------------------------------------------------------ */

/**
 * Generate a shop inventory array from the item index.
 *
 * Algorithm:
 *   1. Compute item level band from partyLevel + wealthTier offset table.
 *   2. Compute target item count range from locationSize table, pick random value.
 *   3. Build a weighted category draw list for the given shopType.
 *   4. For each slot: shuffle-pick a category from the draw list, call
 *      getItemsForShop(category, min, max), pick a random item.  Track used
 *      _ids so duplicates are not added.  If a category has no available items
 *      after dedup, skip that slot rather than erroring.
 *   5. Return the collected array of item index entries.
 *
 * @param {string} shopType      Key from GMTOOLKIT.SHOP_TYPES
 * @param {number} partyLevel    Party average level — used to anchor the level band
 * @param {string} wealthTier    'poor' | 'standard' | 'wealthy' | 'elite'
 * @param {string} locationSize  'village' | 'town' | 'city'
 * @returns {Array}  Item index entries (lightweight objects with _id, packId, name, etc.)
 */
GMTOOLKIT.generateShopInventory = function (shopType, partyLevel, wealthTier, locationSize) {
  /* Guard: item index must exist and be non-empty. */
  if (!GMTOOLKIT._itemIndex || GMTOOLKIT._itemIndex.length === 0) {
    console.warn("PF2e GM Toolkit | generateShopInventory: _itemIndex is empty — returning [].");
    return [];
  }

  /* Guard: shopType must be a recognised key. */
  if (!_SHOP_CATEGORY_WEIGHTS[shopType]) {
    console.warn("PF2e GM Toolkit | generateShopInventory: unknown shopType '" + shopType + "' — defaulting to 'general'.");
    shopType = "general";
  }

  /* ---- Level band by wealth tier ---- */
  var level = (typeof partyLevel === "number" && !isNaN(partyLevel)) ? partyLevel : 5;
  var minLevel, maxLevel;
  switch (wealthTier) {
    case "poor":
      minLevel = level - 4; maxLevel = level - 1; break;
    case "wealthy":
      minLevel = level - 2; maxLevel = level + 1; break;
    case "elite":
      minLevel = level - 1; maxLevel = level + 2; break;
    default: /* 'standard' and any unrecognised value */
      minLevel = level - 3; maxLevel = level;
  }
  /* Clamp to valid PF2e item level range (1 through 20). */
  if (minLevel < 1) minLevel = 1;
  if (maxLevel < 1) maxLevel = 1;

  /* ---- Item count by location size ---- */
  var countMin, countMax;
  switch (locationSize) {
    case "village": countMin = 8;  countMax = 10; break;
    case "city":    countMin = 18; countMax = 22; break;
    default:        countMin = 12; countMax = 15; /* 'town' */
  }
  /* Pick a random count in the range (inclusive). */
  var targetCount = countMin + Math.floor(Math.random() * (countMax - countMin + 1));

  /* ---- Build weighted category draw list ---- */
  var weights  = _SHOP_CATEGORY_WEIGHTS[shopType];
  var drawList = _buildWeightedDrawList(weights);

  /* ---- Draw items ---- */
  var usedIds  = {};   /* Track _id strings to avoid duplicate items */
  var inventory = [];

  /*
   * Per-slot loop: pick a category at random from the weighted draw list,
   * fetch candidate items for that category+level, pick one at random.
   * We attempt up to targetCount * 3 rounds to account for dedup failures,
   * but stop as soon as we have targetCount items.
   */
  var maxAttempts = targetCount * 3;
  var attempts = 0;

  while (inventory.length < targetCount && attempts < maxAttempts) {
    attempts++;

    /* Pick a category from the weighted draw list. */
    var catIndex = Math.floor(Math.random() * drawList.length);
    var category = drawList[catIndex];

    /* Fetch candidates from the item index for this category + level band. */
    var candidates = GMTOOLKIT.getItemsForShop(category, minLevel, maxLevel);

    if (!candidates || candidates.length === 0) {
      /* No items available for this category/level — skip this slot. */
      continue;
    }

    /* Pick a random candidate. */
    var pick = candidates[Math.floor(Math.random() * candidates.length)];

    /* Skip if we already included this item (dedup by _id). */
    if (usedIds[pick._id]) continue;

    usedIds[pick._id] = true;
    inventory.push(pick);
  }

  if (inventory.length < targetCount) {
    console.warn(
      "PF2e GM Toolkit | generateShopInventory: only found " + inventory.length +
      " unique items (wanted " + targetCount + ") for shopType='" + shopType +
      "' level " + minLevel + "-" + maxLevel + "."
    );
  }

  return inventory;
};

/* ------------------------------------------------------------------ */
/* generateSpecialtyItem                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ask the configured AI provider for one specialty item appropriate to this shop.
 *
 * Returns an object { name, description, price, level } on success, or null on
 * any failure (AI disabled, network error, bad JSON response, missing fields).
 *
 * This function has its own try/catch so a failure here NEVER blocks actor
 * creation — the caller should treat the return value as optional.
 *
 * @param {string} shopType       Key from GMTOOLKIT.SHOP_TYPES
 * @param {string} npcName        NPC's name (for personalised prompt)
 * @param {string} npcOccupation  NPC's occupation (for personalised prompt)
 * @returns {Promise<{name:string, description:string, price:string, level:number}|null>}
 */
GMTOOLKIT.generateSpecialtyItem = async function (shopType, npcName, npcOccupation) {
  /* Hard guard: do nothing if AI is not configured. */
  if (!GMTOOLKIT.isAIEnabled || !GMTOOLKIT.isAIEnabled()) return null;
  if (!GMTOOLKIT.callLLM) {
    console.warn("PF2e GM Toolkit | generateSpecialtyItem: callLLM not available.");
    return null;
  }

  /* Resolve the human-readable shop label for the prompt. */
  var shopLabel = (GMTOOLKIT.SHOP_TYPES && GMTOOLKIT.SHOP_TYPES[shopType])
    ? GMTOOLKIT.SHOP_TYPES[shopType]
    : shopType;

  var prompt =
    "You are a Pathfinder 2e game master. A merchant NPC named " + npcName +
    " (" + npcOccupation + ") runs a " + shopLabel + " shop. " +
    "Generate one memorable specialty item they sell that fits their character. " +
    "Respond ONLY with valid JSON:\n" +
    "{\n" +
    "  \"name\": \"item name\",\n" +
    "  \"description\": \"2-3 sentence description of what it is and why this merchant has it\",\n" +
    "  \"price\": \"X gp\",\n" +
    "  \"level\": number between 1 and 10\n" +
    "}";

  try {
    var raw = await GMTOOLKIT.callLLM(prompt);

    if (!raw || typeof raw !== "string") {
      console.warn("PF2e GM Toolkit | generateSpecialtyItem: LLM returned empty/non-string response.");
      return null;
    }

    /* Strip markdown code fences if the LLM wrapped the JSON in ```json ... ``` */
    var cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      /* Remove leading ``` or ```json line and trailing ``` */
      cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "").trim();
    }

    var parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (jsonErr) {
      console.warn("PF2e GM Toolkit | generateSpecialtyItem: could not parse LLM JSON:", jsonErr.message, "\nRaw:", raw);
      return null;
    }

    /* Validate required fields — return null rather than passing bad data to actor creation. */
    if (typeof parsed.name !== "string" || !parsed.name.trim()) {
      console.warn("PF2e GM Toolkit | generateSpecialtyItem: parsed result missing 'name'.");
      return null;
    }

    return {
      name:        String(parsed.name).trim(),
      description: String(parsed.description || "").trim(),
      price:       String(parsed.price || "0 gp").trim(),
      level:       (typeof parsed.level === "number") ? Math.max(1, Math.min(20, Math.round(parsed.level))) : 1,
    };

  } catch (err) {
    /* Catch-all: network errors, LLM timeouts, unexpected exceptions.
       We log but never re-throw so actor creation continues without the specialty item. */
    console.error("PF2e GM Toolkit | generateSpecialtyItem failed (non-blocking):", err);
    return null;
  }
};
