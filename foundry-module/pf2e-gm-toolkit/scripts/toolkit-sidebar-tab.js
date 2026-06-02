/**
 * Dedicated PF2e GM Toolkit sidebar tab — Phase 2 Sidebar Cockpit.
 *
 * Provides an in-session cockpit with:
 *   Zone 1 — Context strip (party line + terrain selector)
 *   Zone 2 — Session history (last 5 items, most recent first)
 *   Zone 3 — Wandering monster d6 table (terrain-aware, lockable slots)
 *   Zone 4 — Hazard panel (filterable, place/describe/randomise)
 *   Zone 5 — Launch buttons (Encounter Builder / NPC Generator)
 */

class GMToolkitSidebarTab extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sidebar.AbstractSidebarTab
) {
  static tabName = "gmtoolkit";

  static DEFAULT_OPTIONS = {
    id: "pf2e-gm-toolkit-sidebar",
    classes: ["pf2e-gm-toolkit", "gmt-toolkit-sidebar"],
    tag: "section",
    window: {
      frame: false,
      positioned: false,
    },
    actions: {
      /* Existing launch buttons — kept from Phase 1. */
      openEncounter:    GMToolkitSidebarTab._onOpenEncounter,
      openNPC:          GMToolkitSidebarTab._onOpenNPC,
      /* Zone 1 — terrain selector. */
      changeTerrain:    GMToolkitSidebarTab._onTerrainChange,
      /* Zone 2 — session history. */
      openHistoryItem:  GMToolkitSidebarTab._onOpenHistoryItem,
      /* Zone 3 — wandering table. */
      rollWandering:    GMToolkitSidebarTab._onRollWandering,
      refreshTable:     GMToolkitSidebarTab._onRefreshTable,
      toggleLock:       GMToolkitSidebarTab._onToggleLock,
      placeWandering:   GMToolkitSidebarTab._onPlaceWandering,
      /* Zone 4 — hazard panel. */
      randomHazard:           GMToolkitSidebarTab._onRandomHazard,
      describeHazard:         GMToolkitSidebarTab._onDescribeHazard,
      placeHazard:            GMToolkitSidebarTab._onPlaceHazard,
      hazardSearchInput:      GMToolkitSidebarTab._onHazardSearch,
      hazardCategoryChange:   GMToolkitSidebarTab._onHazardCategory,
    },
  };

  static PARTS = {
    content: {
      template: "modules/pf2e-gm-toolkit/templates/toolkit-sidebar.hbs",
    },
  };

  constructor(options = {}) {
    super(options);

    /* Zone 3 — wandering table state. */
    this._wanderingTable  = [];     /* array of 6 { monster, locked } entries */
    this._tableGenerating = false;
    this._rolledSlot      = null;   /* 0-based index of the most recently rolled slot */

    /* Zone 4 — hazard panel state. */
    this._hazardResults   = [];     /* currently displayed hazard list (max 8) */
    this._hazardFilter    = { category: "" };
    this._hazardSearchTerm = "";
  }

  /**
   * Register the tab with Foundry's right sidebar.
   * Called during init before the sidebar app is constructed.
   */
  static register() {
    const Sidebar = foundry.applications.sidebar.Sidebar;

    CONFIG.ui.gmtoolkit = GMToolkitSidebarTab;
    Sidebar.TABS.gmtoolkit = {
      icon: "fas fa-dice-d20",
      tooltip: "PF2e GM Toolkit",
      gmOnly: true,
    };
  }

  /**
   * Re-render the sidebar tab when async module indexes become available.
   * Also attempts to (re)generate the wandering table once data is ready.
   */
  static refresh() {
    const app = ui?.gmtoolkit;
    if (!app?.rendered) return;

    /* If the monster index just became available and the table is empty,
       populate it now — this is the deferred first-load case. */
    if (GMTOOLKIT._moduleData && app._wanderingTable.length === 0) {
      app._regenerateWanderingTable();
    }

    /* If the hazard index just became available and results are empty,
       populate them using the current filter state. */
    if (GMTOOLKIT._hazardIndex && app._hazardResults.length === 0) {
      app._rebuildHazardResults();
    }

    app.render({ force: true });
  }

  /** Prepare data for the Handlebars template. */
  async _prepareContext(_options) {
    const moduleData = GMTOOLKIT._moduleData;
    const hazardIndex = GMTOOLKIT._hazardIndex;

    /* ---- Lazy initialisation: populate panel data the first time we
       render after the indexes become available. ---------------------------------------- */
    if (moduleData && this._wanderingTable.length === 0) {
      this._regenerateWanderingTable();
    }

    if (hazardIndex && this._hazardResults.length === 0) {
      this._rebuildHazardResults();
    }

    /* ---- Zone 1: party + terrain ---- */
    const party = GMTOOLKIT.detectParty?.() ?? { partyLevel: null, partySize: null };
    const partyLine = (party.partyLevel && party.partySize)
      ? `Party: ${party.partySize} × Lv ${party.partyLevel}`
      : "Party: not detected";

    const currentTerrain = GMTOOLKIT._currentTerrain ?? "any";

    const terrainOptions = GMTOOLKIT.TERRAIN_TYPES.map((key) => ({
      value: key,
      label: GMTOOLKIT.TERRAIN_LABELS[key] ?? key,
    }));

    /* ---- Zone 2: session history (last 5, most recent first) ---- */
    const allHistory = GMTOOLKIT._sessionHistory ?? [];
    const sessionHistory = allHistory.slice(0, 5).map((entry, i) => ({
      ...entry,
      displayIndex: i,
    }));

    /* ---- Zone 3: wandering table ---- */
    const wanderingTable = this._wanderingTable.map((entry, i) => ({
      monster: entry.monster,
      locked:  entry.locked,
      dieNum:  i + 1,                      /* 1-based die face */
      rolled:  (this._rolledSlot === i),   /* highlight flag */
    }));

    /* ---- Zone 4: hazard panel ---- */
    const hazardIndexReady = Array.isArray(hazardIndex);
    const hazardResults    = this._hazardResults.slice(0, 8);

    const hazardCategoryOptions = [
      { value: "trap",          label: GMTOOLKIT.HAZARD_CATEGORY_LABELS?.trap          ?? "Trap"          },
      { value: "environmental", label: GMTOOLKIT.HAZARD_CATEGORY_LABELS?.environmental ?? "Environmental" },
      { value: "magical",       label: GMTOOLKIT.HAZARD_CATEGORY_LABELS?.magical       ?? "Magical"       },
    ];

    return {
      /* Meta */
      dataReady:       !!moduleData,
      /* Zone 1 */
      partyLine,
      currentTerrain,
      terrainOptions,
      /* Zone 2 */
      sessionHistory,
      /* Zone 3 */
      wanderingTable,
      /* Zone 4 */
      hazardIndexReady,
      hazardResults,
      hazardFilter:       this._hazardFilter,
      hazardSearchTerm:   this._hazardSearchTerm,
      hazardCategoryOptions,
      /* Legacy status fields kept for backward compat with any existing partials. */
      monsterCount:    moduleData?.monsterIndex?.length ?? 0,
      aiEnabled:       GMTOOLKIT.isAIEnabled(),
    };
  }

  /* ============================================================
   * Internal helpers
   * ============================================================ */

  /**
   * Regenerate all unlocked wandering table slots using the current terrain.
   * Pure: reads GMTOOLKIT state, writes this._wanderingTable.
   * Safe to call before moduleData is ready — returns without error.
   */
  _regenerateWanderingTable() {
    if (!GMTOOLKIT._moduleData) return;

    const { monsterIndex, terrainMapping } = GMTOOLKIT._moduleData;
    const party       = GMTOOLKIT.detectParty?.() ?? { partyLevel: null };
    const partyLevel  = party.partyLevel ?? 5;   /* sensible default if party not detected */
    const terrain     = GMTOOLKIT._currentTerrain ?? "any";

    /* Build a fresh table, passing the existing table so locked slots survive. */
    this._wanderingTable = GMTOOLKIT.buildWanderingTable(
      partyLevel,
      terrain,
      monsterIndex,
      terrainMapping,
      this._wanderingTable   /* existing — locked entries are preserved inside */
    );

    /* Clear any rolled highlight — table changed, highlight is stale. */
    this._rolledSlot = null;
  }

  /**
   * Rebuild _hazardResults from the full hazard index, applying current filters.
   * Safe to call before the hazard index is ready.
   */
  _rebuildHazardResults() {
    const index = GMTOOLKIT._hazardIndex;
    if (!Array.isArray(index) || index.length === 0) {
      this._hazardResults = [];
      return;
    }

    const party      = GMTOOLKIT.detectParty?.() ?? { partyLevel: null };
    const partyLevel = party.partyLevel ?? 5;
    const minLevel   = partyLevel - 2;
    const maxLevel   = partyLevel + 2;
    const searchTerm = (this._hazardSearchTerm || "").toLowerCase().trim();
    const category   = this._hazardFilter.category || "";

    const results = [];
    for (let i = 0; i < index.length; i++) {
      const h = index[i];

      /* Level band filter. */
      if (h.level < minLevel || h.level > maxLevel) continue;

      /* Category filter. */
      if (category && h.category !== category) continue;

      /* Name search filter — case-insensitive substring match. */
      if (searchTerm && !(h.name || "").toLowerCase().includes(searchTerm)) continue;

      results.push(h);

      /* Cap at 8 visible rows. */
      if (results.length >= 8) break;
    }

    this._hazardResults = results;
  }

  /* ============================================================
   * Static action handlers
   * ApplicationV2 actions receive `this` bound to the app instance.
   * ============================================================ */

  /* ---- Existing launch button handlers ---- */

  static _openOrFocus(appId, AppClass) {
    if (!game.user.isGM) return;
    const existing = foundry.applications.instances.get(appId);
    if (existing) existing.bringToFront();
    else new AppClass().render(true);
  }

  static _onOpenEncounter(_event, _target) {
    GMToolkitSidebarTab._openOrFocus("pf2e-gm-toolkit-encounter", EncounterBuilderApp);
  }

  static _onOpenNPC(_event, _target) {
    GMToolkitSidebarTab._openOrFocus("pf2e-gm-toolkit-npc", NPCGeneratorApp);
  }

  /* ---- Zone 1: terrain change ---- */

  static _onTerrainChange(event, target) {
    /* `this` is the app instance via ApplicationV2 action binding. */
    const app = this;

    /* Update the canonical terrain state read by all other tools. */
    GMTOOLKIT._currentTerrain = target.value;

    /* Regenerate the wandering table immediately — terrain change invalidates
       all unlocked slots. Locked slots are preserved by _regenerateWanderingTable. */
    app._regenerateWanderingTable();

    app.render({ force: true });
  }

  /* ---- Zone 2: session history ---- */

  static async _onOpenHistoryItem(event, target) {
    const idx  = parseInt(target.dataset.index, 10);
    const history = GMTOOLKIT._sessionHistory ?? [];
    const entry   = history[idx];
    if (!entry) return;

    if (entry.ref?.journalId) {
      /* Open the saved journal entry if it exists. */
      const je = game.journal.get(entry.ref.journalId);
      if (je) { je.sheet.render(true); return; }
    }

    /* Fall back: re-open the relevant tool window with the last result. */
    if (entry.type === "encounter") {
      GMToolkitSidebarTab._openOrFocus("pf2e-gm-toolkit-encounter", EncounterBuilderApp);
    } else if (entry.type === "npc") {
      GMToolkitSidebarTab._openOrFocus("pf2e-gm-toolkit-npc", NPCGeneratorApp);
    }
  }

  /* ---- Zone 3: wandering table ---- */

  static _onRollWandering(event, _target) {
    const app = this;
    if (!app._wanderingTable.length) return;

    /* Pick a random slot (0–5), preferring non-null monster entries. */
    const validSlots = app._wanderingTable
      .map((entry, i) => (entry.monster ? i : -1))
      .filter((i) => i >= 0);

    if (validSlots.length === 0) return;

    const slotIndex = validSlots[Math.floor(Math.random() * validSlots.length)];
    app._rolledSlot = slotIndex;

    const monster = app._wanderingTable[slotIndex].monster;
    ui.notifications.info(
      `PF2e GM Toolkit | Wandering: d6 rolled ${slotIndex + 1} — ${monster.name} (Level ${monster.level})`
    );

    app.render({ force: true });
  }

  static _onRefreshTable(_event, _target) {
    const app = this;
    /* Clear locked state is NOT reset — only unlock slots will be regenerated.
       _regenerateWanderingTable preserves existing[i].locked === true slots. */
    app._regenerateWanderingTable();
    app.render({ force: true });
  }

  static _onToggleLock(event, target) {
    const app  = this;
    const slot = parseInt(target.dataset.slot, 10);
    if (isNaN(slot) || slot < 0 || slot >= app._wanderingTable.length) return;

    /* Toggle the locked flag in place — do not replace the entry. */
    app._wanderingTable[slot] = {
      ...app._wanderingTable[slot],
      locked: !app._wanderingTable[slot].locked,
    };

    app.render({ force: true });
  }

  static async _onPlaceWandering(event, target) {
    const monsterId = target.dataset.monsterId;
    const packId    = target.dataset.packId;

    if (!monsterId || !packId) {
      ui.notifications.warn("PF2e GM Toolkit | Cannot place token — missing monster data.");
      return;
    }

    /* Build a minimal summary entry compatible with placeEncounterTokens.
       Shape must match what summariseCreatures() produces:
       { name, level, hp, ac, xpEach, role, count, packId, actorId, remaster } */
    const tableEntry = (this._wanderingTable || []).find(
      (e) => e.monster && e.monster._id === monsterId && e.monster.packId === packId
    );
    const monster = tableEntry?.monster;

    const summaryEntry = {
      name:    monster?.name    ?? "Unknown",
      level:   monster?.level   ?? 0,
      hp:      monster?.hp      ?? 0,
      ac:      monster?.ac      ?? 0,
      xpEach:  0,              /* wandering placement — XP tracking not needed */
      role:    "Monster",
      count:   1,
      packId:  packId,
      actorId: monsterId,
      remaster: monster?.remaster ?? false,
    };

    try {
      const ids = await GMTOOLKIT.placeEncounterTokens([summaryEntry], { hidden: true, addToCombat: false });
      if (ids.length > 0) {
        ui.notifications.info(
          `PF2e GM Toolkit | Placed ${summaryEntry.name} as a hidden token on the scene.`
        );
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | Wandering token placement failed:", err);
      ui.notifications.error("Failed to place wandering monster token. Check the console.");
    }
  }

  /* ---- Zone 4: hazard panel ---- */

  static _onRandomHazard(_event, _target) {
    const app = this;
    if (!app._hazardResults.length) {
      ui.notifications.warn("PF2e GM Toolkit | No hazards in the current list.");
      return;
    }

    const idx   = Math.floor(Math.random() * app._hazardResults.length);
    const hazard = app._hazardResults[idx];
    ui.notifications.info(
      `PF2e GM Toolkit | Random hazard: ${hazard.name} (Level ${hazard.level}, ${hazard.category})`
    );
  }

  static _onDescribeHazard(event, target) {
    /* Guard: gm-share.js must be loaded for the whisper pathway to work. */
    if (!GMTOOLKIT.shareContent) {
      ui.notifications.warn("PF2e GM Toolkit | Share utility not loaded.");
      return;
    }

    const idx    = parseInt(target.dataset.hazardIndex, 10);
    const hazard = this._hazardResults[idx];
    if (!hazard) return;

    /* Build the whisper body from the hazard's stored description text.
       Fields are already plain-text (HTML-stripped at index time). */
    const lines = [];
    if (hazard.description) lines.push(hazard.description);
    if (hazard.trigger)     lines.push("\nTrigger: " + hazard.trigger);
    if (hazard.disable)     lines.push("Disable: " + hazard.disable);
    if (hazard.stealth !== null) lines.push("Stealth: " + hazard.stealth);

    GMTOOLKIT.shareContent({
      text:       lines.join("\n"),
      title:      hazard.name,
      type:       "hazard",
      saveTarget: "none",   /* no auto-save for hazard descriptions */
    });
  }

  static async _onPlaceHazard(event, target) {
    const hazardId = target.dataset.hazardId;
    const packId   = target.dataset.packId;

    if (!hazardId || !packId) {
      ui.notifications.warn("PF2e GM Toolkit | Cannot place hazard — missing data attributes.");
      return;
    }

    /* Hazards are Actor documents in PF2e — reuse the encounter token pipeline.
       Build a minimal summary entry compatible with placeEncounterTokens. */
    const hazardEntry = this._hazardResults.find(
      (h) => h._id === hazardId && h.packId === packId
    );

    const summaryEntry = {
      name:    hazardEntry?.name  ?? "Unknown Hazard",
      level:   hazardEntry?.level ?? 0,
      hp:      0,    /* hazards do not always expose HP in the index */
      ac:      0,
      xpEach:  0,
      role:    "Hazard",
      count:   1,
      packId:  packId,
      actorId: hazardId,
      remaster: false,
    };

    try {
      const ids = await GMTOOLKIT.placeEncounterTokens([summaryEntry], { hidden: true, addToCombat: false });

      if (ids.length > 0) {
        ui.notifications.info(
          `PF2e GM Toolkit | Placed ${summaryEntry.name} on the scene.`
        );
      }

      /* Also open the compendium sheet so the GM can read the full stat block. */
      try {
        const pack = game.packs.get(packId);
        const doc  = await pack?.getDocument(hazardId);
        if (doc) doc.sheet?.render(true);
      } catch (sheetErr) {
        /* Opening the sheet is a convenience — never fatal. */
        console.warn("PF2e GM Toolkit | Could not open hazard sheet:", sheetErr);
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | Hazard placement failed:", err);

      /* Placement pipeline failed — fall back to just opening the compendium sheet
         so the GM at least has access to the stat block. */
      try {
        const pack = game.packs.get(packId);
        const doc  = await pack?.getDocument(hazardId);
        if (doc) {
          doc.sheet?.render(true);
          ui.notifications.warn(
            "PF2e GM Toolkit | Token placement failed — opened compendium sheet instead."
          );
        }
      } catch (fallbackErr) {
        ui.notifications.error("Failed to place or open hazard. Check the console.");
      }
    }
  }

  static _onHazardSearch(event, target) {
    const app = this;
    app._hazardSearchTerm = target.value || "";
    app._rebuildHazardResults();
    app.render({ force: true });
  }

  static _onHazardCategory(event, target) {
    const app = this;
    app._hazardFilter = { ...app._hazardFilter, category: target.value || "" };
    app._rebuildHazardResults();
    app.render({ force: true });
  }
}
