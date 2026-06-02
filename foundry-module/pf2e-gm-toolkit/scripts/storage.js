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
