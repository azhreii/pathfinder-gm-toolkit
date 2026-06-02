/**
 * Encounter-building rules. Ported from encounter_logic.py.
 * Pure logic — no UI, no fetch calls. All functions are exported on GMTOOLKIT.
 */

/**
 * Return true if a monster fits the requested terrain per terrain_mapping.json rules.
 * @param {object} monster
 * @param {string} terrain
 * @param {object} terrainMapping  full terrain_mapping.json contents
 */
GMTOOLKIT.monsterMatchesTerrain = function (monster, terrain, terrainMapping) {
  const defs = terrainMapping.terrain_definitions ?? {};
  if (!(terrain in defs)) return false;

  const terrainData = defs[terrain];
  const monsterTraits = new Set(monster.traits ?? []);

  /* If the monster has any excluded traits it cannot appear here. */
  const excludeTraits = new Set(terrainData.exclude_traits ?? []);
  for (const t of monsterTraits) {
    if (excludeTraits.has(t)) return false;
  }

  /* Positive matches: creature type, special trait, or specific ancestry. */
  const positiveTraits = new Set([
    ...(terrainData.creature_types ?? []),
    ...(terrainData.special_traits ?? []),
    ...(terrainData.specific_ancestries ?? []),
  ]);
  for (const t of monsterTraits) {
    if (positiveTraits.has(t)) return true;
  }

  return false;
};

/**
 * Map the level difference between a creature and the party to PF2e encounter XP.
 * @param {number} creatureLevel
 * @param {number} partyLevel
 * @returns {number}
 */
GMTOOLKIT.getCreatureXP = function (creatureLevel, partyLevel) {
  const diff = creatureLevel - partyLevel;
  const table = { "-4": 10, "-3": 15, "-2": 20, "-1": 30, 0: 40, 1: 60, 2: 80, 3: 120, 4: 160 };
  if (diff < -4) return 10;
  if (diff > 4) return 160;
  return table[diff] ?? 40;
};

/**
 * Calculate the target XP budget for a given party size and difficulty label.
 * @param {number} partySize
 * @param {string} difficulty
 * @returns {number}
 */
GMTOOLKIT.calculateXPBudget = function (partySize, difficulty) {
  const base = { trivial: 40, low: 60, moderate: 80, severe: 120, extreme: 160 };
  const adj  = { trivial: 10, low: 20, moderate: 20, severe: 30, extreme: 40 };
  return (base[difficulty] ?? 80) + ((partySize - 4) * (adj[difficulty] ?? 20));
};

/**
 * Return the full template definitions. Matches Python's get_encounter_templates().
 */
GMTOOLKIT.getEncounterTemplates = function () {
  return {
    boss_and_lackeys: {
      name: "Boss and Lackeys",
      xp: 120,
      difficulty: "severe",
      structure: [
        { count: 1, levelMod: 2, role: "Boss" },
        { count: 4, levelMod: -4, role: "Lackey" },
      ],
    },
    boss_and_lieutenant: {
      name: "Boss and Lieutenant",
      xp: 120,
      difficulty: "severe",
      structure: [
        { count: 1, levelMod: 2, role: "Boss" },
        { count: 1, levelMod: 0, role: "Lieutenant" },
      ],
    },
    elite_enemies: {
      name: "Elite Enemies",
      xp: 120,
      difficulty: "severe",
      structure: [
        { count: 3, levelMod: 0, role: "Elite" },
      ],
    },
    lieutenant_and_lackeys: {
      name: "Lieutenant and Lackeys",
      xp: 80,
      difficulty: "moderate",
      structure: [
        { count: 1, levelMod: 0, role: "Lieutenant" },
        { count: 4, levelMod: -4, role: "Lackey" },
      ],
    },
    mated_pair: {
      name: "Mated Pair",
      xp: 80,
      difficulty: "moderate",
      structure: [
        { count: 2, levelMod: 0, role: "Standard" },
      ],
    },
    troop: {
      name: "Troop",
      xp: 80,
      difficulty: "moderate",
      structure: [
        { count: 1, levelMod: 0, role: "Leader" },
        { count: 2, levelMod: -2, role: "Soldier" },
      ],
    },
    mook_squad: {
      name: "Mook Squad",
      xp: 60,
      difficulty: "low",
      structure: [
        { count: 6, levelMod: -4, role: "Mook" },
      ],
    },
  };
};

/** Pick a random element from an array. */
function _randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build an encounter from a named template.
 * Returns { creatures, templateName, difficulty, xpBudget, error } where
 * creatures is an array of { monster, role } objects.
 */
GMTOOLKIT.generateEncounterFromTemplate = function (templateKey, partyLevel, partySize, terrain, monsterIndex, terrainMapping) {
  const templates = GMTOOLKIT.getEncounterTemplates();
  if (!(templateKey in templates)) {
    return { error: `Unknown template: ${templateKey}` };
  }

  const template = templates[templateKey];
  const xpBudget = GMTOOLKIT.calculateXPBudget(partySize, template.difficulty);

  const terrainMonsters = monsterIndex.filter(
    (m) => GMTOOLKIT.monsterMatchesTerrain(m, terrain, terrainMapping)
  );
  if (terrainMonsters.length === 0) {
    return { error: `No monsters found for terrain: ${terrain}` };
  }

  const creatures = [];
  for (const group of template.structure) {
    const targetLevel = partyLevel + group.levelMod;
    let pool = terrainMonsters.filter((m) => m.level === targetLevel);
    if (pool.length === 0) {
      pool = terrainMonsters.filter((m) => Math.abs(m.level - targetLevel) <= 1);
    }
    if (pool.length === 0) {
      return { error: `Cannot build ${template.name} — no monsters near level ${targetLevel} for ${terrain}` };
    }
    for (let i = 0; i < group.count; i++) {
      creatures.push({ monster: _randomChoice(pool), role: group.role });
    }
  }

  return {
    creatures,
    templateName: template.name,
    difficulty: template.difficulty,
    xpBudget,
    baseXP: template.xp,
    terrain,
    partyLevel,
    partySize,
    generationType: "template",
    templateKey,
  };
};

/**
 * Build an encounter using a weighted random template selection.
 */
GMTOOLKIT.generateRandomEncounter = function (partyLevel, partySize, terrain, monsterIndex, terrainMapping) {
  const weights = {
    mook_squad: 3, mated_pair: 3, troop: 3,
    lieutenant_and_lackeys: 2, elite_enemies: 1,
    boss_and_lieutenant: 1, boss_and_lackeys: 1,
  };

  /* Build a weighted pool then pick one. */
  const pool = [];
  for (const [key, weight] of Object.entries(weights)) {
    for (let i = 0; i < weight; i++) pool.push(key);
  }

  return GMTOOLKIT.generateEncounterFromTemplate(
    _randomChoice(pool), partyLevel, partySize, terrain, monsterIndex, terrainMapping
  );
};

/**
 * Build an encounter by filling an XP budget with randomly chosen viable monsters.
 */
GMTOOLKIT.generateCustomEncounter = function (partyLevel, partySize, difficulty, terrain, monsterIndex, terrainMapping) {
  const xpBudget = GMTOOLKIT.calculateXPBudget(partySize, difficulty);

  const terrainMonsters = monsterIndex.filter(
    (m) => GMTOOLKIT.monsterMatchesTerrain(m, terrain, terrainMapping)
  );
  if (terrainMonsters.length === 0) {
    return { error: `No monsters found for terrain: ${terrain}` };
  }

  const minLevel = Math.max(-1, partyLevel - 4);
  const maxLevel = partyLevel + 4;
  const viable = terrainMonsters.filter((m) => m.level >= minLevel && m.level <= maxLevel);
  if (viable.length === 0) {
    return { error: `No monsters in appropriate level range for ${terrain}` };
  }

  const creatures = [];
  let currentXP = 0;
  let attempts = 0;

  while (currentXP < xpBudget && creatures.length < 8 && attempts < 100) {
    attempts++;
    const monster = _randomChoice(viable);
    const monsterXP = GMTOOLKIT.getCreatureXP(monster.level, partyLevel);

    if (currentXP + monsterXP <= xpBudget + 20) {
      creatures.push({ monster, role: "Enemy" });
      currentXP += monsterXP;
      if (Math.abs(currentXP - xpBudget) <= 15) break;
    }
  }

  return {
    creatures,
    templateName: `Custom ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`,
    difficulty,
    xpBudget,
    actualXP: currentXP,
    terrain,
    partyLevel,
    partySize,
    generationType: "custom",
  };
};

/**
 * Given a pinned boss creature and a remaining XP budget, fill the encounter
 * with supporting creatures that share at least one meaningful (non-generic)
 * trait with the boss.  Falls back to any terrain-valid creature if no
 * trait-matched pool exists so the budget can always be filled.
 *
 * @param {object} boss           Full monster object from the index (the pinned boss).
 * @param {number} remainingBudget  XP budget after subtracting the boss's XP cost.
 * @param {number} partyLevel
 * @param {string} terrain
 * @param {object[]} monsterIndex
 * @param {object} terrainMapping
 * @returns {{ creatures: Array<{monster, role}>, actualXP: number }}
 */
GMTOOLKIT.generateSupportingCreatures = function (boss, remainingBudget, partyLevel, terrain, monsterIndex, terrainMapping) {
  /* Step 1: collect terrain-valid candidates in the level band. */
  const minLevel = Math.max(-1, partyLevel - 4);
  const maxLevel = partyLevel + 4;

  const terrainPool = monsterIndex.filter(
    (m) => GMTOOLKIT.monsterMatchesTerrain(m, terrain, terrainMapping)
          && m.level >= minLevel
          && m.level <= maxLevel
          /* Don't include the boss itself as a supporting creature. */
          && m._id !== boss._id
  );

  /* Step 2: determine the boss's meaningful (non-generic) traits. */
  const genericTraits = GMTOOLKIT.BOSS_PIN_GENERIC_TRAITS;
  const bossTraits = new Set((boss.traits ?? []).filter((t) => !genericTraits.has(t)));

  /* Step 3: prefer creatures that share at least one meaningful trait.
     Fall back to the full terrain pool if the filtered pool is empty. */
  let candidatePool = terrainPool.filter((m) => {
    const mTraits = m.traits ?? [];
    return mTraits.some((t) => !genericTraits.has(t) && bossTraits.has(t));
  });

  if (candidatePool.length === 0) {
    /* No trait overlap found — use the full terrain pool so we still produce
       a valid encounter rather than an empty one.  Log a note for debugging. */
    console.log("PF2e GM Toolkit | Boss pin: no trait-matched supporters found; using full terrain pool.");
    candidatePool = terrainPool;
  }

  /* Step 4: fill the budget with randomly chosen supporters (same loop
     structure as generateCustomEncounter). */
  const creatures = [];
  let currentXP = 0;
  let attempts = 0;

  while (currentXP < remainingBudget && creatures.length < 7 && attempts < 100) {
    attempts++;
    const monster = _randomChoice(candidatePool);
    const monsterXP = GMTOOLKIT.getCreatureXP(monster.level, partyLevel);

    if (currentXP + monsterXP <= remainingBudget + 20) {
      creatures.push({ monster, role: "Supporter" });
      currentXP += monsterXP;
      if (Math.abs(currentXP - remainingBudget) <= 15) break;
    }
  }

  return { creatures, actualXP: currentXP };
};

/**
 * Build a 6-entry wandering monster table filtered to terrain and level band.
 * Returns a stable array — locked slots are never replaced.
 *
 * Rarity weighting: common entries appear in the pool 3×, uncommon 2×, rare 1×.
 * This means common creatures are picked ~50% of the time, uncommon ~33%, rare ~17%.
 *
 * @param {number}  partyLevel
 * @param {string}  terrain
 * @param {Array}   monsterIndex
 * @param {object}  terrainMapping
 * @param {Array}   [existingTable=[]]  Pass current table to preserve locked slots
 * @returns {Array}  6 entries of { monster, locked }
 */
GMTOOLKIT.buildWanderingTable = function (partyLevel, terrain, monsterIndex, terrainMapping, existingTable) {
  /* Default existingTable to empty array — no locked slots on first call. */
  var existing = existingTable || [];

  /* Level band: party level ±3 for wider variety than the encounter builder's ±4. */
  var minLevel = partyLevel - 3;
  var maxLevel = partyLevel + 3;

  /* Filter by terrain AND level band.
     When terrain is "any" or not found, monsterMatchesTerrain will return false for
     every terrain-specific monster — so we fall back to the full level band. */
  var pool;
  if (!terrain || terrain === "any") {
    /* "Any" terrain — use the full index filtered only by level band. */
    pool = monsterIndex.filter(function (m) {
      return m.level >= minLevel && m.level <= maxLevel;
    });
  } else {
    pool = monsterIndex.filter(function (m) {
      return m.level >= minLevel &&
             m.level <= maxLevel &&
             GMTOOLKIT.monsterMatchesTerrain(m, terrain, terrainMapping);
    });

    /* If terrain filtering produced nothing, fall back to level-band only.
       This can happen for terrains with very sparse trait coverage. */
    if (pool.length === 0) {
      pool = monsterIndex.filter(function (m) {
        return m.level >= minLevel && m.level <= maxLevel;
      });
    }
  }

  /* Safety: if the index is empty or the level band has nothing, return
     6 empty/locked slots rather than throwing. */
  if (pool.length === 0) {
    var empty = [];
    for (var ei = 0; ei < 6; ei++) {
      empty.push(existing[ei] || { monster: null, locked: false });
    }
    return empty;
  }

  /* Build a weighted pool: common → 3 copies, uncommon → 2, rare → 1.
     This biases picks toward common creatures while still allowing rare ones. */
  var weightedPool = [];
  for (var wi = 0; wi < pool.length; wi++) {
    var m = pool[wi];
    var rarity = (m.rarity || "common").toLowerCase();
    var copies = (rarity === "rare") ? 1 : (rarity === "uncommon") ? 2 : 3;
    for (var ci = 0; ci < copies; ci++) {
      weightedPool.push(m);
    }
  }

  /* Pick 6 distinct creature _ids (by id, falling back to name for id-less entries).
     Locked slots are preserved from the existing table and their ids excluded
     from the "already used" set so a locked goblin doesn't block a second goblin. */
  var result = [];
  var usedIds = new Set();

  /* First pass: copy locked slots directly. */
  for (var li = 0; li < 6; li++) {
    if (existing[li] && existing[li].locked) {
      result[li] = existing[li];
      /* Record the locked monster's id so we try to avoid exact duplicates. */
      var lockedId = existing[li].monster && (existing[li].monster._id || existing[li].monster.name);
      if (lockedId) usedIds.add(lockedId);
    } else {
      result[li] = null; /* placeholder — will be filled in the second pass */
    }
  }

  /* Second pass: fill unlocked slots with randomly chosen distinct creatures.
     We cap attempts to avoid infinite loops when the pool is very small. */
  for (var si = 0; si < 6; si++) {
    if (result[si] !== null) continue; /* already locked */

    var picked = null;
    var attempts = 0;
    var maxAttempts = weightedPool.length * 3;

    while (attempts < maxAttempts) {
      attempts++;
      var candidate = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      var candidateId = candidate._id || candidate.name;

      /* Accept this candidate if we haven't used the same creature already.
         When the pool is smaller than 6 we allow duplicates after one full pass. */
      if (!usedIds.has(candidateId) || weightedPool.length < 6) {
        picked = candidate;
        usedIds.add(candidateId);
        break;
      }
    }

    /* If we still have nothing after all attempts, just pick at random. */
    if (!picked) {
      picked = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    }

    result[si] = { monster: picked, locked: false };
  }

  return result;
};

/**
 * Summarise encounter creatures into a display-friendly array, collapsing duplicates.
 * Returns [{name, role, count, level, hp, ac, xpEach, remaster}]
 */
GMTOOLKIT.summariseCreatures = function (creatures, partyLevel) {
  const grouped = new Map();
  for (const { monster, role } of creatures) {
    const key = `${role}::${monster.name}`;
    if (!grouped.has(key)) {
      grouped.set(key, { monster, role, count: 0 });
    }
    grouped.get(key).count++;
  }

  return Array.from(grouped.values()).map(({ monster, role, count }) => ({
    name: monster.name,
    role,
    count,
    level: monster.level,
    hp: monster.hp,
    ac: monster.ac,
    xpEach: GMTOOLKIT.getCreatureXP(monster.level, partyLevel),
    remaster: monster.remaster ?? false,
    /* Pass compendium identifiers through so the template can link to sheets
       and placeEncounterTokens can fetch the full actor document. */
    packId: monster.packId ?? "",
    actorId: monster._id ?? "",
  }));
};
