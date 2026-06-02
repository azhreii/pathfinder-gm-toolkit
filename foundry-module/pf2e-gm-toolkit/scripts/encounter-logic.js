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
  }));
};
