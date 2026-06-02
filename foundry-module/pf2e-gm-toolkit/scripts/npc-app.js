/**
 * NPC Generator UI — ApplicationV2 (Foundry v13).
 */

class NPCGeneratorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "pf2e-gm-toolkit-npc",
    classes: ["pf2e-gm-toolkit", "npc-generator"],
    tag: "div",
    window: {
      title: "PF2e NPC Generator",
      resizable: true,
    },
    position: { width: 560, height: "auto" },
    actions: {
      generate: NPCGeneratorApp._onGenerate,
      saveJournal: NPCGeneratorApp._onSaveJournal,
      clearResult: NPCGeneratorApp._onClearResult,
    },
  };

  static PARTS = {
    form: {
      template: "modules/pf2e-gm-toolkit/templates/npc-app.hbs",
    },
  };

  constructor(options = {}) {
    super(options);
    this._lastNPC = null;
    this._isGenerating = false;
  }

  async _prepareContext(_options) {
    return {
      npc: this._lastNPC,
      isGenerating: this._isGenerating,
      hasResult: !!this._lastNPC,
      hasGeminiKey: !!GMTOOLKIT.getGeminiKey(),
    };
  }

  _onRender(_context, _options) {
    /* Nothing extra to wire up for this simpler form. */
  }

  /** Generate button handler. */
  static async _onGenerate(event, target) {
    const app = this;

    if (!GMTOOLKIT._moduleData) {
      ui.notifications.error("GM Toolkit data not loaded yet — please wait a moment.");
      return;
    }

    const form = app.element.querySelector("form");
    const data = new FormData(form);
    const useAI = data.get("useAI") === "on" && !!GMTOOLKIT.getGeminiKey();

    const { npcNames } = GMTOOLKIT._moduleData;

    app._isGenerating = true;
    await app.render({ force: true });

    const npc = GMTOOLKIT.generateBasicNPC(npcNames);
    if (!npc) {
      ui.notifications.error("NPC name data unavailable.");
      app._isGenerating = false;
      await app.render({ force: true });
      return;
    }

    if (useAI) {
      const aiData = await GMTOOLKIT.enhanceNPCWithAI(npc.name, npc.race, npc.sex);
      if (aiData) {
        Object.assign(npc, GMTOOLKIT.applyAIEnhancement(npc, aiData));
      }
      /* If AI fails we still display the basic NPC. */
    }

    app._lastNPC = npc;
    app._isGenerating = false;
    await app.render({ force: true });
  }

  /** Save NPC to journal. */
  static async _onSaveJournal(event, target) {
    const app = this;
    if (!app._lastNPC) return;

    try {
      const entry = await GMTOOLKIT.saveNPCToJournal(app._lastNPC);
      ui.notifications.info(`NPC saved to journal: "${entry.name}"`);
    } catch (err) {
      console.error("PF2e GM Toolkit | Failed to save NPC:", err);
      ui.notifications.error("Failed to save NPC to journal.");
    }
  }

  /** Clear result. */
  static async _onClearResult(event, target) {
    const app = this;
    app._lastNPC = null;
    await app.render({ force: true });
  }
}
