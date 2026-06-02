/**
 * NPC Actor creation helpers.
 *
 * Risk mitigation: we import full actor data from compendium rather than
 * constructing from scratch. PF2e's data is the schema authority — we only
 * overwrite the name and biography surface fields.
 */

/* Trait sets used to classify an NPC archetype into a display category.
   These mirror the Python-side occupation/trait logic at a coarser level —
   the goal is a quick, GM-readable label for the picker, not precise rules. */
const _SPELLCASTER_TRAITS = new Set([
  "arcane", "divine", "occult", "primal",
  "sorcerer", "wizard", "cleric", "druid",
  "bard", "witch", "oracle", "magus", "summoner",
]);

const _SPECIALIST_TRAITS = new Set([
  "alchemist", "merchant", "artisan", "healer",
  "scholar", "rogue", "criminal", "assassin", "acrobat",
]);

const _COMBATANT_TRAITS = new Set([
  "soldier", "warrior", "guard", "fighter",
  "barbarian", "ranger", "champion", "swashbuckler", "investigator",
]);

/**
 * Infer a display category from a creature's trait set.
 * Returns one of: "Spellcaster", "Specialist", "Combatant",
 * "Non-combatant", or "Other".
 *
 * @param {string[]} traits
 * @returns {string}
 */
function _inferCategory(traits) {
  const t = new Set(traits);
  /* Check spellcaster first — a cleric with warrior traits reads as a spellcaster. */
  if ([...t].some(function (x) { return _SPELLCASTER_TRAITS.has(x); })) return "Spellcaster";
  if ([...t].some(function (x) { return _SPECIALIST_TRAITS.has(x); }))  return "Specialist";
  if ([...t].some(function (x) { return _COMBATANT_TRAITS.has(x); }))   return "Combatant";
  /* "humanoid" without any of the above is a generic townsfolk / NPC. */
  if (t.has("humanoid")) return "Non-combatant";
  return "Other";
}

/**
 * Build an index of NPC archetypes from all Actor compendium packs.
 *
 * Each entry shape:
 *   { packId, actorId, name, level, category, traits[] }
 *
 * Only indexes actors of type "npc". Packs that fail (locked, corrupt, etc.)
 * are skipped with a console warning so one bad pack does not abort the whole
 * startup sequence.
 *
 * The result is stored on GMTOOLKIT._archetypeIndex so the picker and
 * getArchetypesForLevel() can read it synchronously after startup.
 *
 * Called from main.js inside the "ready" hook after buildMonsterIndex().
 *
 * @returns {Promise<Array>}
 */
GMTOOLKIT.buildArchetypeIndex = async function () {
  var archetypes = [];

  for (var i = 0; i < game.packs.size; i++) {
    /* game.packs is a Collection — iterate via its contents array. */
    var pack = game.packs.contents[i];
    if (pack.metadata.type !== "Actor") continue;

    try {
      var index = await pack.getIndex({
        fields: [
          "type",
          "system.details.level.value",
          "system.traits.value",
        ],
      });

      for (var j = 0; j < index.size; j++) {
        var entry = index.contents[j];
        if (entry.type !== "npc") continue;

        var level = entry.system && entry.system.details && entry.system.details.level
          ? entry.system.details.level.value
          : undefined;

        /* Skip entries with no level — they're not useful for the level-filtered picker. */
        if (level === undefined || level === null) continue;

        var traits = (entry.system && entry.system.traits && entry.system.traits.value)
          ? entry.system.traits.value
          : [];

        /* Only include humanoid creatures — filters out animals, undead, elementals,
           and other monsters that are not useful as NPC mechanical bases. */
        if (!traits.includes("humanoid")) continue;

        archetypes.push({
          packId:   pack.collection,
          actorId:  entry._id,
          name:     entry.name,
          level:    level,
          category: _inferCategory(traits),
          traits:   traits,
        });
      }
    } catch (err) {
      console.warn("PF2e GM Toolkit | Skipping archetype index for " + pack.collection + ":", err.message);
    }
  }

  console.log("PF2e GM Toolkit | Indexed " + archetypes.length + " NPC archetypes");
  return archetypes;
};

/**
 * Return archetypes filtered by level proximity (±1 level) and optional category.
 *
 * Reads from the cached GMTOOLKIT._archetypeIndex built at startup.
 * Returns an empty array if the index has not been built yet, rather than
 * throwing — the UI will show "no archetypes found" which is the safe fallback.
 *
 * @param {number} targetLevel   creature level to match (±1)
 * @param {string} [category]    display category string or null/"All" to skip filter
 * @returns {Array}
 */
GMTOOLKIT.getArchetypesForLevel = function (targetLevel, category) {
  var index = GMTOOLKIT._archetypeIndex;
  if (!Array.isArray(index)) return [];

  return index.filter(function (a) {
    var levelOk = Math.abs(a.level - targetLevel) <= 1;
    var catOk   = !category || category === "All" || a.category === category;
    return levelOk && catOk;
  });
};

/**
 * Build biography HTML from an NPC profile object.
 * Only includes fields that are actually populated — AI-enhanced NPCs will
 * have appearance/motivation/secret/quote; basic NPCs will not.
 *
 * @param {object} profile  NPC profile from generateBasicNPC / applyAIEnhancement
 * @returns {string}        HTML string safe to store in system.details.biography.value
 */
function _buildBiographyHTML(profile) {
  var lines = [];
  if (profile.appearance)  lines.push("<p><strong>Appearance:</strong> " + profile.appearance + "</p>");
  if (profile.personality) lines.push("<p><strong>Personality:</strong> " + profile.personality + "</p>");
  if (profile.occupation)  lines.push("<p><strong>Occupation:</strong> " + profile.occupation + "</p>");
  if (profile.motivation)  lines.push("<p><strong>Motivation:</strong> " + profile.motivation + "</p>");
  if (profile.secret)      lines.push("<p><em>Secret: " + profile.secret + "</em></p>");
  if (profile.quote)       lines.push("<p><em>\"" + profile.quote + "\"</em></p>");
  /* Race and sex are always present on generated NPCs. */
  lines.push(
    "<p><strong>Race:</strong> " + (profile.race || "") +
    " &nbsp;|&nbsp; <strong>Sex:</strong> " + (profile.sex || "") + "</p>"
  );
  return lines.join("\n");
}

/**
 * Create a Foundry Actor by importing a compendium archetype and overlaying
 * the generated NPC profile onto name and biography ONLY.
 *
 * Safe approach: we call pack.getDocument() to get PF2e's fully validated
 * actor document, then pass its .toObject() to Actor.create() as the base.
 * This means PF2e's own schema is authoritative for every stat field — we
 * never touch HP, AC, saves, strikes, or abilities.
 *
 * The compendium source link is removed so the created actor is a standalone
 * world actor rather than a compendium-linked clone (which would prevent
 * editing in the sheet).
 *
 * @param {object} profile    NPC profile from generateBasicNPC / applyAIEnhancement
 * @param {object} archetype  entry from _archetypeIndex: { packId, actorId, name }
 * @returns {Promise<Actor>}
 */
GMTOOLKIT.createNPCActorFromArchetype = async function (profile, archetype) {
  var pack = game.packs.get(archetype.packId);
  if (!pack) throw new Error("Compendium not found: " + archetype.packId);

  var source = await pack.getDocument(archetype.actorId);
  if (!source) throw new Error("Actor not found in compendium: " + archetype.actorId);

  /* toObject() returns a plain data object — safe to mutate and pass to Actor.create(). */
  var data = source.toObject();

  /* Overwrite ONLY the safe surface fields. Nothing below this touches any stat. */
  data.name = profile.name;

  /* Biography is nested under system.details.biography.value in PF2e's schema.
     We guard against missing intermediate objects defensively — some NPC types
     (familiars, vehicles accidentally typed as npc) may not have this path. */
  if (data.system && data.system.details && data.system.details.biography) {
    data.system.details.biography.value = _buildBiographyHTML(profile);
  }

  /* Remove the compendium source link so this actor is fully standalone.
     Without this removal, Foundry may treat the actor as a compendium clone
     and prevent certain edits or prompt to re-sync from the source. */
  if (data.flags && data.flags.core && data.flags.core.sourceId) {
    delete data.flags.core.sourceId;
  }
  if (data.flags && data.flags.pf2e && data.flags.pf2e.linkToActorData !== undefined) {
    data.flags.pf2e.linkToActorData = false;
  }

  /* renderSheet: false — the caller (npc-app.js _onCreateActor) opens the sheet
     explicitly after creation so the GM sees it without a double-render flash. */
  return Actor.create(data, { renderSheet: false });
};

/**
 * Create a minimal NPC Actor without any archetype — no stat block.
 *
 * Used when the GM clicks "Create Actor (no stats)" without selecting an
 * archetype from the picker. The resulting actor has only a name and
 * biography; the GM fills in all combat stats manually in the sheet.
 *
 * This is intentionally thin — a thin actor is better than a broken one.
 *
 * @param {object} profile  NPC profile from generateBasicNPC / applyAIEnhancement
 * @returns {Promise<Actor>}
 */
GMTOOLKIT.createBasicNPCActorNoArchetype = async function (profile) {
  return Actor.create({
    name: profile.name,
    type: "npc",
    system: {
      details: {
        /* PF2e's biography field — value holds an HTML string. */
        biography: { value: _buildBiographyHTML(profile) },
      },
    },
  }, { renderSheet: false });
};
