/**
 * Encounter Builder UI — ApplicationV2 (Foundry v13).
 */

class EncounterBuilderApp extends foundry.applications.api.ApplicationV2 {
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
      generate: EncounterBuilderApp._onGenerate,
      saveJournal: EncounterBuilderApp._onSaveJournal,
      clearResult: EncounterBuilderApp._onClearResult,
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

    return {
      terrainOptions,
      templateOptions,
      difficultyOptions,
      /* Pass the full label map so templates can resolve terrain keys to names. */
      terrainLabels: GMTOOLKIT.TERRAIN_LABELS,
      encounter: this._lastEncounter,
      summary: this._lastSummary,
      isGenerating: this._isGenerating,
      hasResult: !!this._lastEncounter,
      hasGeminiKey: !!GMTOOLKIT.getGeminiKey(),
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
    const partyLevel = parseInt(data.get("partyLevel"), 10);
    const partySize = parseInt(data.get("partySize"), 10);
    const terrain = data.get("terrain");
    const genMode = data.get("genMode");
    const templateKey = data.get("templateKey");
    const difficulty = data.get("difficulty");
    const useAI = data.get("useAI") === "on" && !!GMTOOLKIT.getGeminiKey();

    const { monsterIndex, terrainMapping } = GMTOOLKIT._moduleData;

    app._isGenerating = true;
    await app.render({ force: true });

    let result;
    if (genMode === "random") {
      result = GMTOOLKIT.generateRandomEncounter(partyLevel, partySize, terrain, monsterIndex, terrainMapping);
    } else if (genMode === "template") {
      result = GMTOOLKIT.generateEncounterFromTemplate(templateKey, partyLevel, partySize, terrain, monsterIndex, terrainMapping);
    } else {
      result = GMTOOLKIT.generateCustomEncounter(partyLevel, partySize, difficulty, terrain, monsterIndex, terrainMapping);
    }

    if (result.error) {
      ui.notifications.warn(result.error);
      app._isGenerating = false;
      await app.render({ force: true });
      return;
    }

    const summary = GMTOOLKIT.summariseCreatures(result.creatures, partyLevel);

    /* Optional AI enrichment — does not block display of the base result. */
    if (useAI) {
      const monstersForAI = result.creatures.map((c) => ({ name: c.monster.name, level: c.monster.level }));
      const aiNarrative = await GMTOOLKIT.enhanceEncounterWithAI(terrain, result.templateName, monstersForAI);
      if (aiNarrative) result.aiNarrative = aiNarrative;
    }

    app._lastEncounter = result;
    app._lastSummary = summary;
    app._isGenerating = false;
    await app.render({ force: true });
  }

  /** Save result to journal. */
  static async _onSaveJournal(event, target) {
    const app = this;
    if (!app._lastEncounter || !app._lastSummary) return;

    try {
      const entry = await GMTOOLKIT.saveEncounterToJournal(app._lastEncounter, app._lastSummary);
      ui.notifications.info(`Encounter saved to journal: "${entry.name}"`);
    } catch (err) {
      console.error("PF2e GM Toolkit | Failed to save encounter:", err);
      ui.notifications.error("Failed to save encounter to journal.");
    }
  }

  /** Clear the current result. */
  static async _onClearResult(event, target) {
    const app = this;
    app._lastEncounter = null;
    app._lastSummary = null;
    await app.render({ force: true });
  }
}
