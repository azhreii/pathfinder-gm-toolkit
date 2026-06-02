/**
 * Encounter Builder UI — ApplicationV2 (Foundry v13).
 */

class EncounterBuilderApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "pf2e-gm-toolkit-encounter",
    classes: ["pf2e-gm-toolkit", "encounter-builder"],
    tag: "div",
    window: {
      title: "PF2e Encounter Builder",
      resizable: true,
    },
    position: { width: 680, height: "auto" },
    actions: {
      generate:         EncounterBuilderApp._onGenerate,
      saveJournal:      EncounterBuilderApp._onSaveJournal,
      clearResult:      EncounterBuilderApp._onClearResult,
      placeTokens:      EncounterBuilderApp._onPlaceTokens,
      openSheet:        EncounterBuilderApp._onOpenSheet,
      shareAINarrative: EncounterBuilderApp._onShareNarrative,
      /* Boss-pinning actions. */
      pinBoss:          EncounterBuilderApp._onPinBoss,
      unpinBoss:        EncounterBuilderApp._onUnpinBoss,
    },
  };

  static PARTS = {
    form: {
      template: "modules/pf2e-gm-toolkit/templates/encounter-app.hbs",
    },
  };

  constructor(options = {}) {
    super(options);
    /* State held between renders. */
    this._lastEncounter = null;
    this._lastSummary = null;
    this._isGenerating = false;
    /**
     * The currently pinned boss, or null.
     * Shape: { monster: <full monster object from index>, xpCost: number }
     * Stored as the raw monster object so we can pass it back to logic functions
     * without having to re-look it up from the index.
     */
    this._pinnedBoss = null;
  }

  /** Prepare data for the Handlebars template. */
  async _prepareContext(_options) {
    /* Build terrain options array for the select. */
    const terrainOptions = GMTOOLKIT.TERRAIN_TYPES.map((key) => ({
      value: key,
      label: GMTOOLKIT.TERRAIN_LABELS[key] ?? key,
    }));

    /* Build template options array. */
    const templateOptions = Object.entries(GMTOOLKIT.ENCOUNTER_TEMPLATES).map(([key, label]) => ({
      value: key,
      label,
    }));

    /* Build difficulty options array. */
    const difficultyOptions = GMTOOLKIT.DIFFICULTIES.map((d) => ({
      value: d,
      label: GMTOOLKIT.DIFFICULTY_LABELS[d] ?? d,
    }));

    /* Detect live party state and scene context.
       Both helpers return null fields safely if called before "ready". */
    const party = GMTOOLKIT.detectParty?.() ?? { partyLevel: null, partySize: null };
    const sceneTerrain = GMTOOLKIT._currentTerrain ?? GMTOOLKIT.detectSceneTerrain?.() ?? null;
    const hasActiveScene = !!canvas?.scene;

    /* Enrich the summary rows with a flag indicating which row is the pinned boss
       so the template can render the badge and the correct pin/unpin button.
       We match by monster _id when available, falling back to name comparison. */
    const pinnedBossId   = this._pinnedBoss?.monster?._id   ?? null;
    const pinnedBossName = this._pinnedBoss?.monster?.name  ?? null;

    const enrichedSummary = (this._lastSummary ?? []).map((row) => {
      /* A summary row represents the pinned boss if its actorId or name matches. */
      const isBoss = pinnedBossId
        ? row.actorId === pinnedBossId
        : (pinnedBossName !== null && row.name === pinnedBossName);
      return { ...row, isBoss };
    });

    return {
      terrainOptions,
      templateOptions,
      difficultyOptions,
      /* Pass the full label map so templates can resolve terrain keys to names. */
      terrainLabels: GMTOOLKIT.TERRAIN_LABELS,
      encounter: this._lastEncounter,
      summary: enrichedSummary,
      isGenerating: this._isGenerating,
      hasResult: !!this._lastEncounter,
      hasGeminiKey: GMTOOLKIT.isAIEnabled(),
      /* Live-detected values pre-populate the form when available. */
      detectedPartyLevel: party.partyLevel,
      detectedPartySize: party.partySize,
      detectedTerrain: sceneTerrain,
      hasActiveScene,
      /* Boss-pin state — used by the result header note and row badges. */
      pinnedBossName,
      hasPinnedBoss: !!this._pinnedBoss,
    };
  }

  /** Bind dynamic UI behaviours after each render. */
  _onRender(_context, _options) {
    const html = this.element;

    /* Show/hide the template selector vs difficulty selector based on gen type. */
    const modeSelect = html.querySelector("[name='genMode']");
    if (modeSelect) {
      modeSelect.addEventListener("change", () => this._updateModeVisibility(html));
      this._updateModeVisibility(html);
    }
  }

  _updateModeVisibility(html) {
    const mode = html.querySelector("[name='genMode']")?.value;
    const templateRow = html.querySelector(".template-row");
    const difficultyRow = html.querySelector(".difficulty-row");
    if (templateRow) templateRow.hidden = mode !== "template";
    if (difficultyRow) difficultyRow.hidden = mode !== "custom";
  }

  /** Generate button handler. */
  static async _onGenerate(event, target) {
    const app = this; // ApplicationV2 actions receive `this` as the app instance

    if (!GMTOOLKIT._moduleData) {
      ui.notifications.error("GM Toolkit data not loaded yet — please wait a moment.");
      return;
    }

    const form = app.element.querySelector("form");
    const data = new FormData(form);
    /* Fall back to live-detected values when the form fields are blank or zero.
       Final fallback to sensible defaults so generation never NaNs. */
    const party = GMTOOLKIT.detectParty?.() ?? {};
    const partyLevel = (parseInt(data.get("partyLevel"), 10) || party.partyLevel) ?? 5;
    const partySize  = (parseInt(data.get("partySize"),  10) || party.partySize)  ?? 4;
    const terrain = data.get("terrain");
    const genMode = data.get("genMode");
    const templateKey = data.get("templateKey");
    const difficulty = data.get("difficulty");
    const useAI = data.get("useAI") === "on" && GMTOOLKIT.isAIEnabled();

    const { monsterIndex, terrainMapping } = GMTOOLKIT._moduleData;

    app._isGenerating = true;
    await app.render({ force: true });

    let result;

    if (app._pinnedBoss) {
      /* ---- Boss-pinned regeneration path --------------------------------
         The boss is locked.  We only regenerate the supporting creatures.
         Re-use whatever generation mode the GM last chose for the budget
         calculation, but replace the creature list with boss + supporters. */
      const boss    = app._pinnedBoss.monster;
      const bossXP  = app._pinnedBoss.xpCost;

      /* Derive the overall budget from the current form settings. */
      let totalBudget;
      if (genMode === "random" || genMode === "template") {
        /* For template/random modes use a "severe" budget as the baseline
           (120 XP base) adjusted for party size — same as boss_and_lackeys. */
        totalBudget = GMTOOLKIT.calculateXPBudget(partySize, "severe");
      } else {
        totalBudget = GMTOOLKIT.calculateXPBudget(partySize, difficulty);
      }

      const remainingBudget = Math.max(0, totalBudget - bossXP);

      const { creatures: supporters, actualXP: supporterXP } =
        GMTOOLKIT.generateSupportingCreatures(
          boss, remainingBudget, partyLevel, terrain, monsterIndex, terrainMapping
        );

      /* Combine boss (always first) with supporters. */
      const allCreatures = [
        { monster: boss, role: "Boss" },
        ...supporters,
      ];

      result = {
        creatures: allCreatures,
        templateName: `Boss: ${boss.name}`,
        difficulty: genMode === "custom" ? difficulty : "severe",
        xpBudget: totalBudget,
        actualXP: bossXP + supporterXP,
        terrain,
        partyLevel,
        partySize,
        generationType: "bossPin",
        /* Preserve any previous AI narrative — it stays valid for the same boss. */
        aiNarrative: app._lastEncounter?.aiNarrative ?? null,
      };
    } else {
      /* ---- Normal (unpinned) generation path ---------------------------- */
      if (genMode === "random") {
        result = GMTOOLKIT.generateRandomEncounter(partyLevel, partySize, terrain, monsterIndex, terrainMapping);
      } else if (genMode === "template") {
        result = GMTOOLKIT.generateEncounterFromTemplate(templateKey, partyLevel, partySize, terrain, monsterIndex, terrainMapping);
      } else {
        result = GMTOOLKIT.generateCustomEncounter(partyLevel, partySize, difficulty, terrain, monsterIndex, terrainMapping);
      }
    }

    if (result.error) {
      ui.notifications.warn(result.error);
      app._isGenerating = false;
      await app.render({ force: true });
      return;
    }

    const summary = GMTOOLKIT.summariseCreatures(result.creatures, partyLevel);

    /* Optional AI enrichment — does not block display of the base result.
       Skip re-enrichment when a boss is pinned and we already have a narrative. */
    if (useAI && !(app._pinnedBoss && result.aiNarrative)) {
      const monstersForAI = result.creatures.map((c) => ({ name: c.monster.name, level: c.monster.level }));
      const aiNarrative = await GMTOOLKIT.enhanceEncounterWithAI(terrain, result.templateName, monstersForAI);
      if (aiNarrative) result.aiNarrative = aiNarrative;
    }

    app._lastEncounter = result;
    app._lastSummary = summary;
    app._isGenerating = false;

    /* Push a session history entry so the sidebar cockpit can show recent results. */
    const historyName = [result.templateName, terrain, "Lv" + partyLevel].join(" ");
    GMTOOLKIT._sessionHistory = GMTOOLKIT._sessionHistory || [];
    GMTOOLKIT._sessionHistory.unshift({
      type:      "encounter",
      name:      historyName,
      timestamp: Date.now(),
      ref:       { encounter: result, summary: summary },
    });
    /* Keep the history cap at 5 entries so it doesn't grow unbounded. */
    if (GMTOOLKIT._sessionHistory.length > 5) GMTOOLKIT._sessionHistory.pop();
    /* Refresh the sidebar tab if it is open — safe no-op if it isn't. */
    if (typeof GMToolkitSidebarTab !== "undefined" && GMToolkitSidebarTab.refresh) {
      GMToolkitSidebarTab.refresh();
    }

    await app.render({ force: true });
  }

  /** Save result to journal.
   *  Routes through shareContent so all persistence uses one code path.
   *  The underlying GMTOOLKIT.saveEncounterToJournal() function is still
   *  called from within shareContent — we are not duplicating its logic. */
  static async _onSaveJournal(event, target) {
    const app = this;
    if (!app._lastEncounter || !app._lastSummary) return;

    /* Route through shareContent when available; fall back to direct call
       in case gm-share.js is not yet loaded (load-order safety). */
    if (GMTOOLKIT.shareContent) {
      const narrative = app._lastEncounter.aiNarrative;
      /* Build a compact text representation for the whisper body. */
      const textLines = [];
      if (narrative) {
        if (narrative.setting_description) textLines.push("<p><strong>Setting:</strong> " + narrative.setting_description + "</p>");
        if (narrative.encounter_hook)      textLines.push("<p><strong>Hook:</strong> "    + narrative.encounter_hook      + "</p>");
        if (narrative.tactical_notes)      textLines.push("<p><strong>Tactics:</strong> " + narrative.tactical_notes      + "</p>");
      }
      const displayText = textLines.length
        ? textLines.join("\n")
        : "<p>" + app._lastEncounter.templateName + " — Level " + app._lastEncounter.partyLevel + "</p>";

      await GMTOOLKIT.shareContent({
        text:       displayText,
        title:      "Encounter: " + app._lastEncounter.templateName,
        type:       "encounter",
        saveTarget: "journal",
        encounter:  app._lastEncounter,
        summary:    app._lastSummary,
      });
      ui.notifications.info("Encounter saved to journal.");
    } else {
      /* Fallback path: direct call without whisper. */
      try {
        const entry = await GMTOOLKIT.saveEncounterToJournal(app._lastEncounter, app._lastSummary);
        ui.notifications.info("Encounter saved to journal: \"" + entry.name + "\"");
      } catch (err) {
        console.error("PF2e GM Toolkit | Failed to save encounter:", err);
        ui.notifications.error("Failed to save encounter to journal.");
      }
    }
  }

  /** Clear the current result and any pinned boss. */
  static async _onClearResult(event, target) {
    const app = this;
    app._lastEncounter = null;
    app._lastSummary = null;
    /* Clearing the result also releases any boss pin so the next generation
       starts fresh rather than immediately re-entering pinned mode. */
    app._pinnedBoss = null;
    await app.render({ force: true });
  }

  /**
   * Place tokens for the last generated encounter on the active scene.
   * Reads the hidden/addToCombat checkboxes from the form.
   */
  static async _onPlaceTokens(event, target) {
    const app = this;
    /* Nothing to place if no encounter has been generated yet. */
    if (!app._lastSummary?.length) return;

    const form = app.element.querySelector("form");
    const hidden      = form?.querySelector("[name='tokensHidden']")?.checked ?? true;
    const addToCombat = form?.querySelector("[name='addToCombat']")?.checked ?? false;

    try {
      const ids = await GMTOOLKIT.placeEncounterTokens(app._lastSummary, { hidden, addToCombat });
      if (ids.length > 0) {
        ui.notifications.info(`PF2e GM Toolkit | Placed ${ids.length} token(s) on the scene.`);
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | Token placement failed:", err);
      ui.notifications.error("Failed to place tokens. Check the browser console.");
    }
  }

  /**
   * Open the compendium sheet for a creature row in the result table.
   * Requires data-pack-id and data-actor-id attributes on the clicked element.
   */
  static async _onOpenSheet(event, target) {
    const packId  = target.dataset.packId;
    const actorId = target.dataset.actorId;
    /* Guard: both attributes must be present or there is nothing to open. */
    if (!packId || !actorId) return;
    try {
      const pack = game.packs.get(packId);
      const doc  = await pack?.getDocument(actorId);
      doc?.sheet?.render(true);
    } catch (err) {
      console.warn("PF2e GM Toolkit | Could not open compendium sheet:", err);
    }
  }

  /**
   * Pin a creature from the result list as the encounter boss.
   *
   * The button must supply two data attributes:
   *   data-boss-actor-id  — the monster's _id from the index
   *   data-boss-name      — the monster's display name (fallback when no _id)
   *
   * After pinning we immediately regenerate supporting creatures so the result
   * updates without requiring the GM to hit Generate again.
   */
  static async _onPinBoss(event, target) {
    const app = this;

    if (!app._lastEncounter || !GMTOOLKIT._moduleData) return;

    const bossActorId = target.dataset.bossActorId ?? "";
    const bossName    = target.dataset.bossName    ?? "";

    /* Find the matching creature entry in the current encounter creature list.
       Prefer _id match; fall back to name match for monsters without one. */
    const bossEntry = app._lastEncounter.creatures.find((c) =>
      (bossActorId && c.monster._id === bossActorId) ||
      (!bossActorId && c.monster.name === bossName)
    );

    if (!bossEntry) {
      console.warn("PF2e GM Toolkit | Pin boss: could not locate creature in encounter.", { bossActorId, bossName });
      return;
    }

    const boss   = bossEntry.monster;
    const bossXP = GMTOOLKIT.getCreatureXP(boss.level, app._lastEncounter.partyLevel);

    /* Store the pinned boss in app state. */
    app._pinnedBoss = { monster: boss, xpCost: bossXP };

    ui.notifications.info(`PF2e GM Toolkit | Boss pinned: ${boss.name} (${bossXP} XP). Regenerating supporters…`);

    /* Immediately regenerate supporting creatures around the newly pinned boss. */
    const { monsterIndex, terrainMapping } = GMTOOLKIT._moduleData;
    const { partyLevel, partySize, terrain } = app._lastEncounter;

    /* Determine total budget — use the existing encounter's xpBudget. */
    const totalBudget = app._lastEncounter.xpBudget ?? GMTOOLKIT.calculateXPBudget(partySize, "severe");
    const remainingBudget = Math.max(0, totalBudget - bossXP);

    const { creatures: supporters, actualXP: supporterXP } =
      GMTOOLKIT.generateSupportingCreatures(
        boss, remainingBudget, partyLevel, terrain, monsterIndex, terrainMapping
      );

    const allCreatures = [
      { monster: boss, role: "Boss" },
      ...supporters,
    ];

    app._lastEncounter = {
      ...app._lastEncounter,
      creatures: allCreatures,
      templateName: `Boss: ${boss.name}`,
      actualXP: bossXP + supporterXP,
      generationType: "bossPin",
    };

    app._lastSummary = GMTOOLKIT.summariseCreatures(allCreatures, partyLevel);
    await app.render({ force: true });
  }

  /**
   * Share the AI narrative for the current encounter.
   *
   * Posts a GM-only whisper with the full narrative and a "Share with players"
   * button that will post only the setting description and hook (omitting
   * tactical notes and battle map details which are GM planning aids).
   * Also persists the encounter to the journal immediately.
   *
   * Guarded with a GMTOOLKIT.shareContent existence check so the button is
   * a no-op rather than an error if gm-share.js is not loaded.
   */
  static async _onShareNarrative(event, target) {
    const app = this;
    if (!app._lastEncounter) return;

    if (!GMTOOLKIT.shareContent) {
      console.warn("PF2e GM Toolkit | shareContent not available — gm-share.js may not be loaded.");
      ui.notifications.warn("GM Toolkit: Share infrastructure not loaded.");
      return;
    }

    const encounter = app._lastEncounter;
    const narrative = encounter.aiNarrative;

    /* Build a GM-facing HTML body with all narrative sections. */
    const textLines = [];
    if (narrative) {
      if (narrative.setting_description) textLines.push("<p><strong>Setting:</strong> "        + narrative.setting_description + "</p>");
      if (narrative.monster_description) textLines.push("<p><strong>The Encounter:</strong> "  + narrative.monster_description + "</p>");
      if (narrative.encounter_hook)      textLines.push("<p><strong>Hook:</strong> "            + narrative.encounter_hook      + "</p>");
      if (narrative.tactical_notes)      textLines.push("<p><strong>Tactical Notes:</strong> " + narrative.tactical_notes      + "</p>");
      if (narrative.battle_map_details)  textLines.push("<p><strong>Battle Map:</strong> "     + narrative.battle_map_details  + "</p>");
    }

    const formattedNarrative = textLines.length
      ? textLines.join("\n")
      : "<p>No AI narrative available for this encounter.</p>";

    await GMTOOLKIT.shareContent({
      text:       formattedNarrative,
      title:      "Encounter: " + encounter.templateName,
      type:       "encounter",
      saveTarget: "journal",
      encounter:  encounter,
      summary:    app._lastSummary,
    });
  }

  /**
   * Unpin the current boss and return the encounter to free-generation mode.
   * Does NOT automatically regenerate — the GM controls when to press Generate.
   */
  static async _onUnpinBoss(event, target) {
    const app = this;
    if (!app._pinnedBoss) return;

    const bossName = app._pinnedBoss.monster.name;
    app._pinnedBoss = null;

    ui.notifications.info(`PF2e GM Toolkit | Boss unpinned: ${bossName}. Press Generate for a fresh encounter.`);
    await app.render({ force: true });
  }
}
