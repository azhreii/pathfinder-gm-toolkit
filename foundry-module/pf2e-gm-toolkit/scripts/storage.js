/**
 * Persistence helpers. Replaces SQLite with Foundry Journal Entries.
 * Saved NPCs and encounters become journal entries in a "GM Toolkit" folder,
 * which GMs can view, edit, and drag onto actors or scenes.
 */

const JOURNAL_FOLDER_NAME = "GM Toolkit";

/**
 * Get or create the GM Toolkit journal folder.
 * @returns {Promise<Folder>}
 */
async function _getOrCreateFolder() {
  let folder = game.folders.find(
    (f) => f.name === JOURNAL_FOLDER_NAME && f.type === "JournalEntry"
  );
  if (!folder) {
    folder = await Folder.create({ name: JOURNAL_FOLDER_NAME, type: "JournalEntry" });
  }
  return folder;
}

/**
 * Format an NPC object as HTML content for a journal entry.
 * @param {object} npc
 */
function _npcToHTML(npc) {
  const rows = [];
  if (npc.appearance) rows.push(`<p><strong>Appearance:</strong> ${npc.appearance}</p>`);
  if (npc.personality) rows.push(`<p><strong>Personality:</strong> ${npc.personality}</p>`);
  if (npc.occupation) rows.push(`<p><strong>Occupation:</strong> ${npc.occupation}</p>`);
  if (npc.motivation) rows.push(`<p><strong>Motivation:</strong> ${npc.motivation}</p>`);
  if (npc.secret) rows.push(`<p><strong>Secret:</strong> ${npc.secret}</p>`);
  if (npc.quote) rows.push(`<p><em>"${npc.quote}"</em></p>`);

  return `<h2>${npc.name}</h2>
<p><strong>Race:</strong> ${npc.race} &nbsp;|&nbsp; <strong>Sex:</strong> ${npc.sex}</p>
${rows.join("\n")}`;
}

/**
 * Format an encounter result as HTML content for a journal entry.
 * @param {object} encounter  result from generateEncounter* plus optional aiNarrative
 * @param {Array}  summary    result of GMTOOLKIT.summariseCreatures
 */
function _encounterToHTML(encounter, summary) {
  const terrain = GMTOOLKIT.TERRAIN_LABELS[encounter.terrain] ?? encounter.terrain;

  let creaturesHTML = summary
    .map((c) => {
      const label = c.count > 1 ? `${c.count}× ${c.name}` : c.name;
      const remaster = c.remaster ? " <em>[Remaster]</em>" : "";
      return `<li><strong>${label}</strong> (${c.role}) — Level ${c.level} | HP ${c.hp} | AC ${c.ac} | ${c.xpEach} XP each${remaster}</li>`;
    })
    .join("\n");

  let narrativeHTML = "";
  const ai = encounter.aiNarrative;
  if (ai) {
    narrativeHTML = `
<hr>
<h3>Narrative</h3>
<p><strong>Setting:</strong> ${ai.setting_description ?? ""}</p>
<p><strong>The Encounter:</strong> ${ai.monster_description ?? ""}</p>
<p><strong>Hook:</strong> ${ai.encounter_hook ?? ""}</p>
<p><strong>Tactical Notes:</strong> ${ai.tactical_notes ?? ""}</p>
<p><strong>Battle Map:</strong> ${ai.battle_map_details ?? ""}</p>`;
  }

  const xpLine = encounter.actualXP
    ? `XP Budget: ${encounter.xpBudget} (Actual: ${encounter.actualXP})`
    : `XP Budget: ${encounter.xpBudget} (base ${encounter.baseXP ?? encounter.xpBudget})`;

  return `<h2>${encounter.templateName}</h2>
<p><strong>Party:</strong> ${encounter.partySize} characters, Level ${encounter.partyLevel} &nbsp;|&nbsp;
<strong>Difficulty:</strong> ${encounter.difficulty.charAt(0).toUpperCase() + encounter.difficulty.slice(1)} &nbsp;|&nbsp;
<strong>Terrain:</strong> ${terrain}</p>
<p>${xpLine}</p>
<h3>Creatures</h3>
<ul>${creaturesHTML}</ul>${narrativeHTML}`;
}

/**
 * Save an NPC as a Foundry journal entry.
 * @param {object} npc
 * @returns {Promise<JournalEntry>}
 */
GMTOOLKIT.saveNPCToJournal = async function (npc) {
  const folder = await _getOrCreateFolder();
  return JournalEntry.create({
    name: npc.name,
    folder: folder.id,
    pages: [
      {
        name: npc.name,
        type: "text",
        text: { content: _npcToHTML(npc), format: 1 },
      },
    ],
  });
};

/**
 * Save an encounter as a Foundry journal entry.
 * @param {object} encounter  result object from encounter-logic.js
 * @param {Array}  summary    result of GMTOOLKIT.summariseCreatures
 * @returns {Promise<JournalEntry>}
 */
GMTOOLKIT.saveEncounterToJournal = async function (encounter, summary) {
  const folder = await _getOrCreateFolder();
  const title = `${encounter.templateName} (Level ${encounter.partyLevel} ${encounter.difficulty})`;
  return JournalEntry.create({
    name: title,
    folder: folder.id,
    pages: [
      {
        name: title,
        type: "text",
        text: { content: _encounterToHTML(encounter, summary), format: 1 },
      },
    ],
  });
};

/**
 * Build a monster index from every Actor compendium pack Foundry has loaded.
 * This replaces the old bundled monster_index.json — it automatically includes
 * all bestiary books the GM has installed (core, bestiary 2/3, third-party, homebrew).
 *
 * We use getIndex() with specific field paths rather than loading full documents,
 * so this stays fast even with 6,000+ entries across multiple packs.
 *
 * @returns {Promise<Array>} array of { name, level, hp, ac, traits, rarity, packId }
 */
GMTOOLKIT.buildMonsterIndex = async function () {
  const monsters = [];

  for (const pack of game.packs) {
    /* Only Actor packs can contain creatures. */
    if (pack.metadata.type !== "Actor") continue;

    let index;
    try {
      index = await pack.getIndex({
        fields: [
          "type",
          "system.details.level.value",
          "system.attributes.hp.max",
          "system.attributes.ac.value",
          "system.traits.value",
          "system.traits.rarity",
        ],
      });
    } catch (err) {
      /* Non-critical — skip packs that can't be indexed (locked, corrupt, etc.). */
      console.warn(`PF2e GM Toolkit | Skipping pack ${pack.collection}:`, err.message);
      continue;
    }

    for (const entry of index) {
      /* Only include NPC-type actors (not player characters, vehicles, hazards). */
      if (entry.type !== "npc") continue;

      const level = entry.system?.details?.level?.value;
      /* Skip entries that have no level data — they're not usable for XP math. */
      if (level === undefined || level === null) continue;

      monsters.push({
        name: entry.name,
        level,
        hp: entry.system?.attributes?.hp?.max ?? 0,
        ac: entry.system?.attributes?.ac?.value ?? 0,
        traits: entry.system?.traits?.value ?? [],
        rarity: entry.system?.traits?.rarity ?? "common",
        packId: pack.collection,
        _id: entry._id,
      });
    }
  }

  return monsters;
};

/**
 * Derive a category key for a PF2e item given its document type and traits array.
 * Categories are checked in priority order — first match wins:
 *   weapon > armor > consumable > alchemical > magical > treasure > adventuring
 *
 * @param {string}   itemType   e.g. "weapon", "armor", "equipment", "consumable"
 * @param {string[]} traits     item.system.traits.value
 * @returns {string}  A key from GMTOOLKIT.ITEM_CATEGORIES
 */
function _classifyItem(itemType, traits) {
  /* Exact document-type matches come first to avoid trait-based false positives. */
  if (itemType === "weapon")     return "weapon";
  if (itemType === "armor" || itemType === "shield") return "armor";
  if (itemType === "consumable") return "consumable";
  if (itemType === "treasure")   return "treasure";

  /* For equipment-type documents we inspect the traits array. */
  const traitSet = new Set(traits);
  if (traitSet.has("alchemical"))                        return "alchemical";
  if (traitSet.has("magical") || traitSet.has("invested")) return "magical";

  /* Anything else that comes through as an equipment document is generic gear. */
  return "adventuring";
}

/**
 * Format a PF2e price object into a human-readable string such as "5 gp".
 * The price data shape varies across PF2e versions:
 *   - Older: { value: { gp: 5, sp: 0, cp: 0 } }
 *   - Newer: { value: "5 gp" } (already a string)
 * Returns an empty string if no price data is present.
 *
 * @param {*} priceValue   item.system.price.value
 * @returns {string}
 */
function _formatPrice(priceValue) {
  if (!priceValue) return "";

  /* Already a formatted string — pass through directly. */
  if (typeof priceValue === "string") return priceValue;

  /* Object form: accumulate denomination amounts in display order. */
  if (typeof priceValue === "object") {
    const parts = [];
    if (priceValue.pp) parts.push(`${priceValue.pp} pp`);
    if (priceValue.gp) parts.push(`${priceValue.gp} gp`);
    if (priceValue.sp) parts.push(`${priceValue.sp} sp`);
    if (priceValue.cp) parts.push(`${priceValue.cp} cp`);
    return parts.join(", ");
  }

  return String(priceValue);
}

/**
 * Build an item index from every Item compendium pack Foundry has loaded.
 * Covers equipment, weapons, armor, shields, consumables, and treasure.
 * Unique items are excluded — they are plot rewards, not shop inventory.
 *
 * Uses pack.getIndex() with targeted field paths so this stays fast even
 * across large compendium collections; full documents are never loaded.
 *
 * @returns {Promise<Array>}  Flat array of lightweight item descriptor objects.
 */
GMTOOLKIT.buildItemIndex = async function () {
  /* Guard against being called before Foundry's packs collection is ready. */
  if (!game.packs || game.packs.size === 0) {
    console.warn("PF2e GM Toolkit | buildItemIndex called before game.packs was populated — returning empty array.");
    return [];
  }

  const items = [];

  /* The PF2e document types we want to include in the shop index.
     All of these live in Item-type compendium packs. */
  const INCLUDED_TYPES = new Set([
    "weapon", "armor", "shield", "equipment", "consumable", "treasure",
  ]);

  for (const pack of game.packs) {
    /* Item packs have metadata.type === "Item" (capital I, matching Foundry's
       document type name).  Skip Actor, JournalEntry, etc. */
    if (pack.metadata.type !== "Item") continue;

    let index;
    try {
      index = await pack.getIndex({
        fields: [
          "type",
          "system.level.value",
          "system.price.value",
          "system.traits.value",
          "system.traits.rarity",
        ],
      });
    } catch (err) {
      /* One broken or locked pack must not abort the entire index build. */
      console.warn(`PF2e GM Toolkit | Skipping item pack ${pack.collection}:`, err.message);
      continue;
    }

    for (const entry of index) {
      /* Only index item document types relevant to shop inventory. */
      if (!INCLUDED_TYPES.has(entry.type)) continue;

      /* Items with no name are compendium noise — skip them. */
      if (!entry.name) continue;

      const level = entry.system?.level?.value;
      /* Level must be defined and numeric; non-equipment items sometimes omit it. */
      if (level === undefined || level === null) continue;

      const traits  = entry.system?.traits?.value  ?? [];
      const rarity  = entry.system?.traits?.rarity ?? "common";

      /* Unique items are one-of-a-kind plot rewards and should never appear in
         a procedurally generated shop — they break verisimilitude. */
      if (rarity === "unique") continue;

      items.push({
        _id:      entry._id,
        packId:   pack.collection,
        name:     entry.name,
        level:    Number(level),
        price:    _formatPrice(entry.system?.price?.value),
        category: _classifyItem(entry.type, traits),
        traits,
        rarity,
      });
    }
  }

  console.log(`PF2e GM Toolkit | ${items.length} items indexed`);
  return items;
};

/**
 * Return items matching a category and level band, suitable for shop population.
 * Results are drawn from GMTOOLKIT._itemIndex, which is populated during the
 * ready hook.  Returns an empty array if the index has not yet been built.
 *
 * @param {string} category  Key from GMTOOLKIT.ITEM_CATEGORIES, or null for all
 * @param {number} minLevel  Minimum item level (inclusive)
 * @param {number} maxLevel  Maximum item level (inclusive)
 * @param {number} [limit=50]  Maximum number of results to return
 * @returns {Array}
 */
GMTOOLKIT.getItemsForShop = function (category, minLevel, maxLevel, limit) {
  /* Default limit if not provided. */
  var cap = (limit !== undefined && limit !== null) ? limit : 50;

  var index = GMTOOLKIT._itemIndex;
  if (!index || index.length === 0) return [];

  var results = [];
  for (var i = 0; i < index.length; i++) {
    var item = index[i];

    /* Level band filter — both bounds inclusive. */
    if (item.level < minLevel || item.level > maxLevel) continue;

    /* Category filter — null or omitted means "include everything". */
    if (category && item.category !== category) continue;

    results.push(item);
    if (results.length >= cap) break;
  }

  return results;
};

/**
 * Build a hazard index from every Actor compendium pack Foundry has loaded.
 * PF2e hazards live in Actor packs but are identified by actor.type === "hazard".
 * The existing buildMonsterIndex() skips these; this function specifically targets them.
 *
 * Terrain affinity is inferred from each hazard's traits using GMTOOLKIT.HAZARD_TERRAIN_TRAITS.
 * Hazards that match no terrain are tagged ['any'] so they can appear in any context.
 *
 * @returns {Promise<Array>}  Flat array of lightweight hazard descriptor objects.
 */
GMTOOLKIT.buildHazardIndex = async function () {
  /* Guard against being called before Foundry's packs collection is ready. */
  if (!game.packs || game.packs.size === 0) {
    console.warn("PF2e GM Toolkit | buildHazardIndex called before game.packs was populated — returning empty array.");
    return [];
  }

  const hazards = [];

  /* Pre-build a reverse lookup: trait string -> array of terrain keys that include it.
     This is computed once outside the loop for efficiency across thousands of entries.
     Example: "water" -> ["aquatic", "swamp"] */
  const traitToTerrains = {};
  for (const [terrain, traits] of Object.entries(GMTOOLKIT.HAZARD_TERRAIN_TRAITS)) {
    for (const trait of traits) {
      if (!traitToTerrains[trait]) traitToTerrains[trait] = [];
      traitToTerrains[trait].push(terrain);
    }
  }

  for (const pack of game.packs) {
    /* Hazards are Actor documents in PF2e. */
    if (pack.metadata.type !== "Actor") continue;

    let index;
    try {
      index = await pack.getIndex({
        fields: [
          "type",
          "system.details.level.value",
          "system.details.isComplex",
          "system.details.description",
          "system.details.disable",
          "system.details.trigger",
          "system.attributes.stealth.value",
          "system.traits.value",
          "system.traits.rarity",
        ],
      });
    } catch (err) {
      /* One broken or locked pack must not abort the entire index build. */
      console.warn(`PF2e GM Toolkit | Skipping hazard pack ${pack.collection}:`, err.message);
      continue;
    }

    for (const entry of index) {
      /* Only process hazard-type actors — monsters, PCs, vehicles, etc. are excluded. */
      if (entry.type !== "hazard") continue;

      /* Hazards with no name are invalid compendium entries. */
      if (!entry.name) continue;

      const level = entry.system?.details?.level?.value;
      /* Level must be present; un-levelled hazards cannot be used in level-band queries. */
      if (level === undefined || level === null) continue;

      const traits = entry.system?.traits?.value ?? [];

      /* --- Terrain inference ------------------------------------------------
         Walk each of the hazard's traits and accumulate all terrain keys that
         list that trait.  A Set prevents duplicate terrain assignments when a
         hazard has multiple traits that map to the same terrain (e.g. "plant"
         and "fungus" both mapping to "swamp"). */
      const terrainSet = new Set();
      for (const trait of traits) {
        const matchedTerrains = traitToTerrains[trait];
        if (matchedTerrains) {
          for (const t of matchedTerrains) terrainSet.add(t);
        }
      }
      /* Hazards with no terrain match are universally applicable. */
      const terrains = terrainSet.size > 0 ? Array.from(terrainSet) : ["any"];

      /* --- Category inference -----------------------------------------------
         "magical" wins if the magical trait is present regardless of trap status.
         "trap" wins over "environmental" when the trap trait is present.
         Everything else is classified as environmental. */
      let category;
      const traitSet = new Set(traits);
      if (traitSet.has("magical")) {
        category = "magical";
      } else if (traitSet.has("trap")) {
        category = "trap";
      } else {
        category = "environmental";
      }

      /* Description preview: first 200 chars of HTML-stripped text.
         The raw description may contain HTML markup from Foundry's rich text
         editor — strip tags to avoid showing raw angle-brackets in the sidebar. */
      const rawDesc   = entry.system?.details?.description ?? "";
      const plainDesc = rawDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const description = plainDesc.length > 200
        ? plainDesc.slice(0, 200) + "…"
        : plainDesc;

      hazards.push({
        _id:         entry._id,
        packId:      pack.collection,
        name:        entry.name,
        level:       Number(level),
        complexity:  entry.system?.details?.isComplex ? "complex" : "simple",
        traits,
        terrains,
        description,
        disable:     entry.system?.details?.disable  ?? "",
        trigger:     entry.system?.details?.trigger  ?? "",
        stealth:     entry.system?.attributes?.stealth?.value ?? null,
        category,
      });
    }
  }

  console.log(`PF2e GM Toolkit | ${hazards.length} hazards indexed`);
  return hazards;
};

/**
 * Return hazards matching a level band, optionally filtered by terrain.
 * Level band is [partyLevel - 2, partyLevel + 2] inclusive.
 * Results are drawn from GMTOOLKIT._hazardIndex, populated during the ready hook.
 *
 * @param {number} partyLevel   Party's average level; band = [level-2, level+2]
 * @param {string} [terrain]    Terrain key from GMTOOLKIT.HAZARD_TERRAIN_TRAITS,
 *                              or null / omitted to include all terrains
 * @param {number} [limit=20]   Maximum number of results to return
 * @returns {Array}
 */
GMTOOLKIT.getHazardsForTerrain = function (partyLevel, terrain, limit) {
  /* Default limit if not provided. */
  var cap = (limit !== undefined && limit !== null) ? limit : 20;

  var index = GMTOOLKIT._hazardIndex;
  if (!index || index.length === 0) return [];

  var minLevel = partyLevel - 2;
  var maxLevel = partyLevel + 2;

  /* Normalise terrain: treat empty string the same as null for "any terrain". */
  var terrainFilter = (terrain && terrain !== "any") ? terrain : null;

  var results = [];
  for (var i = 0; i < index.length; i++) {
    var hazard = index[i];

    /* Level band filter — both bounds inclusive. */
    if (hazard.level < minLevel || hazard.level > maxLevel) continue;

    /* Terrain filter:
       - No filter (null) → include all hazards regardless of terrain tags.
       - With filter → include if terrains contains the requested key OR 'any'
         (hazards tagged 'any' are universally applicable and should always be eligible). */
    if (terrainFilter) {
      var terrains = hazard.terrains;
      var matchesTerrain = false;
      for (var j = 0; j < terrains.length; j++) {
        if (terrains[j] === terrainFilter || terrains[j] === "any") {
          matchesTerrain = true;
          break;
        }
      }
      if (!matchesTerrain) continue;
    }

    results.push(hazard);
    if (results.length >= cap) break;
  }

  return results;
};

/**
 * Load the module's bundled data files (terrain mapping and NPC names).
 * Monster data comes from Foundry compendiums via buildMonsterIndex(), not here.
 * Returns { terrainMapping, npcNames } or throws on failure.
 */
GMTOOLKIT.loadModuleData = async function () {
  const base = "modules/pf2e-gm-toolkit/data";
  const [terrainMapping, npcNames] = await Promise.all([
    fetch(`${base}/terrain_mapping.json`).then((r) => r.json()),
    fetch(`${base}/npc_names.json`).then((r) => r.json()),
  ]);
  return { terrainMapping, npcNames };
};

/**
 * Read party level and size from active player characters.
 * Returns { partyLevel, partySize } — either or both may be null if
 * no characters are connected.
 * Safe to call before the "ready" hook fires (returns null fields on any error).
 */
GMTOOLKIT.detectParty = function () {
  try {
    /* PF2e v6+ exposes game.actors.party — the active party actor with all
       members listed regardless of who is currently logged in.  This is the
       most accurate source and handles offline players correctly. */
    var pf2eParty = game.actors && game.actors.party;
    if (pf2eParty && pf2eParty.members && pf2eParty.members.length > 0) {
      var members = pf2eParty.members.filter(function (m) { return m.type === "character"; });
      if (members.length > 0) {
        var partySize = members.length;
        var partyLevel = Math.round(
          members.reduce(function (sum, a) {
            return sum + (a.system && a.system.details && a.system.details.level
              ? a.system.details.level.value : 1);
          }, 0) / partySize
        );
        return { partyLevel: partyLevel, partySize: partySize };
      }
    }

    /* Fallback: read from currently connected non-GM users with assigned characters. */
    var chars = game.users
      .filter(function (u) { return u.active && !u.isGM && u.character; })
      .map(function (u) { return u.character; });
    var size = chars.length || null;
    var level = size > 0
      ? Math.round(
          chars.reduce(function (sum, a) {
            return sum + (a.system && a.system.details && a.system.details.level
              ? a.system.details.level.value : 1);
          }, 0) / size
        )
      : null;
    return { partyLevel: level, partySize: size };
  } catch (e) {
    return { partyLevel: null, partySize: null };
  }
};

/**
 * Read terrain tag from the active scene (set by this module).
 * Returns terrain key string or null.
 * Safe to call before the "ready" hook fires (returns null on any error).
 */
GMTOOLKIT.detectSceneTerrain = function () {
  try {
    return canvas?.scene?.getFlag("pf2e-gm-toolkit", "terrain") ?? null;
  } catch {
    /* canvas may not be initialised yet — return null rather than throw. */
    return null;
  }
};

/**
 * Place tokens on the active scene from a summarised creature list.
 * Hidden from players by default. Returns array of created token IDs.
 * Individual creatures with missing packId or actorId are skipped gracefully.
 *
 * @param {Array}  summary   from GMTOOLKIT.summariseCreatures() — each entry
 *                           must have: name, count, packId, actorId
 * @param {object} options   { hidden: bool, addToCombat: bool }
 * @returns {Promise<string[]>}
 */
GMTOOLKIT.placeEncounterTokens = async function (summary, options) {
  var hidden      = (options && options.hidden      !== undefined) ? options.hidden      : true;
  var addToCombat = (options && options.addToCombat !== undefined) ? options.addToCombat : false;

  var scene = canvas && canvas.scene;
  if (!scene) {
    ui.notifications.warn("PF2e GM Toolkit | No active scene — cannot place tokens.");
    return [];
  }

  /* Tokens in Foundry v13 must reference a world actor — not a compendium document.
     We import each creature into a hidden GM Toolkit folder the first time it is
     needed, then reuse the imported actor on subsequent placements.
     The folder is flagged so we can find it reliably without hard-coding its name. */
  var encounterFolder = game.folders.find(function (f) {
    return f.type === "Actor" && f.getFlag("pf2e-gm-toolkit", "encounterActorFolder");
  });
  if (!encounterFolder) {
    encounterFolder = await Folder.create({
      name:  "GM Toolkit — Encounter Actors",
      type:  "Actor",
      color: "#4a1a72",
      flags: { "pf2e-gm-toolkit": { encounterActorFolder: true } },
    });
  }

  var dims     = scene.dimensions  || {};
  var gridSize = (scene.grid && scene.grid.size) || 100;
  var centerX  = (dims.width  || 2000) / 2;
  var centerY  = (dims.height || 2000) / 2;

  var tokenDataArray = [];
  var slot = 0;

  for (var ci = 0; ci < summary.length; ci++) {
    var creature = summary[ci];

    if (!creature.packId || !creature.actorId) {
      console.warn("PF2e GM Toolkit | Skipping " + creature.name + " — missing packId or actorId.");
      continue;
    }

    var pack = game.packs.get(creature.packId);
    if (!pack) {
      console.warn("PF2e GM Toolkit | Pack not found: " + creature.packId);
      continue;
    }

    /* Check for a previously imported world actor so we never duplicate.
       We track imports under our own flag namespace — NOT flags.core.sourceId,
       which is deprecated in Foundry v13 and fires a warning for every actor
       in the world when accessed via getFlag().
       Direct property access (no getFlag call) avoids the warning entirely. */
    var sourceId = "Compendium." + pack.collection + ".Actor." + creature.actorId;
    var worldActor = game.actors.find(function (a) {
      return a.flags && a.flags["pf2e-gm-toolkit"] &&
             a.flags["pf2e-gm-toolkit"].sourceId === sourceId;
    });

    if (!worldActor) {
      var actorDoc;
      try {
        actorDoc = await pack.getDocument(creature.actorId);
      } catch (err) {
        console.warn("PF2e GM Toolkit | Could not load " + creature.name + ":", err);
        continue;
      }
      if (!actorDoc) continue;

      try {
        /* toObject() is the v13-compatible way to get plain actor data from a
           compendium document. fromCompendium() was deprecated and does not
           correctly resolve token artwork paths in Foundry v13. */
        var actorData = actorDoc.toObject();
        actorData.folder = encounterFolder.id;
        /* Store our own source-tracking flag so the lookup above can find this
           actor on subsequent placements without touching core.sourceId. */
        actorData.flags = actorData.flags || {};
        actorData.flags["pf2e-gm-toolkit"] = actorData.flags["pf2e-gm-toolkit"] || {};
        actorData.flags["pf2e-gm-toolkit"].sourceId = sourceId;
        worldActor = await Actor.create(actorData, { renderSheet: false });
      } catch (err) {
        console.warn("PF2e GM Toolkit | Could not import " + creature.name + ":", err);
        continue;
      }
    }

    var proto = worldActor.prototypeToken.toObject();
    var count = creature.count || 1;

    for (var i = 0; i < count; i++) {
      /* Spiral placement outward from scene centre so tokens don't stack. */
      var angle = slot * (Math.PI * 2) / 8;
      var ring  = Math.floor(slot / 8) + 1;
      var x = Math.round((centerX + Math.cos(angle) * gridSize * ring) / gridSize) * gridSize;
      var y = Math.round((centerY + Math.sin(angle) * gridSize * ring) / gridSize) * gridSize;

      tokenDataArray.push(
        foundry.utils.mergeObject(proto, {
          x:         x,
          y:         y,
          hidden:    hidden,
          actorId:   worldActor.id,
          actorLink: false,
          delta:     { name: creature.name },
        }, { inplace: false })
      );
      slot++;
    }
  }

  if (tokenDataArray.length === 0) return [];

  var created = await scene.createEmbeddedDocuments("Token", tokenDataArray);
  var ids = created.map(function (t) { return t.id; });

  if (addToCombat && ids.length > 0) {
    await GMTOOLKIT._addTokensToCombat(ids, scene);
  }

  return ids;
};

/**
 * Internal helper: add token IDs to the active combat tracker, creating one if needed.
 * @param {string[]} tokenIds
 * @param {Scene}    scene
 */
GMTOOLKIT._addTokensToCombat = async function (tokenIds, scene) {
  try {
    /* Prefer the active encounter, then any encounter already on this scene,
       then create a fresh one.  getDocumentClass("Combat") returns PF2e's
       EncounterPF2e subclass when the PF2e system is loaded, which is required
       for the combat tracker to display correctly. */
    var combat = game.combats.active
      || game.combats.find(function (c) { return c.scene && c.scene.id === scene.id; });

    if (!combat) {
      combat = await getDocumentClass("Combat").create({ scene: scene.id });
    }

    /* Build combatant entries.  PF2e's tracker needs actorId as well as tokenId
       to correctly resolve HP, initiative, and other actor-derived fields. */
    var combatants = [];
    for (var i = 0; i < tokenIds.length; i++) {
      var token = scene.tokens.get(tokenIds[i]);
      if (!token) continue;
      var entry = { tokenId: tokenIds[i], sceneId: scene.id };
      if (token.actorId) entry.actorId = token.actorId;
      combatants.push(entry);
    }

    if (combatants.length > 0) {
      await combat.createEmbeddedDocuments("Combatant", combatants);
    }
  } catch (err) {
    console.error("PF2e GM Toolkit | Failed to add tokens to combat:", err);
  }
};
