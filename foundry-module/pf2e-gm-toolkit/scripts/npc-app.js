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
      generate:              NPCGeneratorApp._onGenerate,
      saveJournal:           NPCGeneratorApp._onSaveJournal,
      clearResult:           NPCGeneratorApp._onClearResult,
      createActor:           NPCGeneratorApp._onCreateActor,
      toggleArchetypePicker: NPCGeneratorApp._onToggleArchetypePicker,
      selectArchetype:       NPCGeneratorApp._onSelectArchetype,
      clearArchetype:        NPCGeneratorApp._onClearArchetype,
      applyArchetypeFilter:  NPCGeneratorApp._onApplyArchetypeFilter,
    },
  };

  static PARTS = {
    form: {
      template: "modules/pf2e-gm-toolkit/templates/npc-app.hbs",
    },
  };

  constructor(options = {}) {
    super(options);
    this._lastNPC        = null;
    this._isGenerating   = false;

    /* Archetype picker state — all start null/false/"" so the picker is
       hidden until the GM explicitly requests it. */
    this._creatureLevel      = null;   // null = auto-detect from party
    this._selectedArchetype  = null;   // { packId, actorId, name } or null
    this._showArchetypePicker = false;
    this._archetypeCategory  = "";     // filter: "" = All
  }

  async _prepareContext(_options) {
    /* Resolve effective creature level: explicit override or party auto-detect. */
    var party = (GMTOOLKIT.detectParty && GMTOOLKIT.detectParty()) || { partyLevel: null };
    var detectedLevel  = party.partyLevel || 1;
    var effectiveLevel = (this._creatureLevel !== null) ? this._creatureLevel : detectedLevel;
    var usingDetected  = (this._creatureLevel === null);

    /* Build sorted category list from the index. "All" is always first. */
    var indexArr = Array.isArray(GMTOOLKIT._archetypeIndex) ? GMTOOLKIT._archetypeIndex : [];
    var catSet = new Set(indexArr.map(function (a) { return a.category; }));
    var categories = ["All"].concat(Array.from(catSet).sort());

    /* Fetch filtered archetypes — cap at 60 so the picker list stays manageable. */
    var archetypes = (GMTOOLKIT.getArchetypesForLevel &&
      GMTOOLKIT.getArchetypesForLevel(effectiveLevel, this._archetypeCategory || null)) || [];

    return {
      npc:          this._lastNPC,
      isGenerating: this._isGenerating,
      hasResult:    !!this._lastNPC,

      /* Use isAIEnabled() when available (added in ai-tools.js); fall back to
         the older getGeminiKey() check so the template still works on older
         builds that do not have isAIEnabled yet. */
      hasGeminiKey: (GMTOOLKIT.isAIEnabled && GMTOOLKIT.isAIEnabled()) ||
                    !!(GMTOOLKIT.getGeminiKey && GMTOOLKIT.getGeminiKey()),

      /* Archetype picker context fields. */
      detectedLevel:       detectedLevel,
      effectiveLevel:      effectiveLevel,
      usingDetected:       usingDetected,
      archetypes:          archetypes.slice(0, 60),
      archetypeCategories: categories,
      selectedArchetype:   this._selectedArchetype,
      showArchetypePicker: this._showArchetypePicker,
      archetypeCategory:   this._archetypeCategory,
      archetypeIndexReady: Array.isArray(GMTOOLKIT._archetypeIndex),
    };
  }

  /**
   * Wire up the creature level input after each render.
   * The input lives inside the form so we query it via the rendered element.
   * We re-render with force:true on change so all derived archetype counts
   * update immediately without waiting for the next user action.
   */
  _onRender(_context, _options) {
    var html = this.element;
    var app = this;
    var levelInput = html.querySelector("[name='creatureLevel']");
    if (levelInput) {
      levelInput.addEventListener("change", function () {
        var v = parseInt(levelInput.value, 10);
        /* Treat out-of-range or NaN as "revert to auto-detect". */
        app._creatureLevel = (!isNaN(v) && v >= 1 && v <= 20) ? v : null;
        app.render({ force: true });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Action handlers                                                      */
  /* ------------------------------------------------------------------ */

  /** Generate button handler. */
  static async _onGenerate(event, target) {
    var app = this;

    if (!GMTOOLKIT._moduleData) {
      ui.notifications.error("GM Toolkit data not loaded yet — please wait a moment.");
      return;
    }

    var form = app.element.querySelector("form");
    var data = new FormData(form);
    /* useAI requires both the checkbox to be on AND a valid API key. */
    var useAI = data.get("useAI") === "on" &&
      !!(GMTOOLKIT.getGeminiKey && GMTOOLKIT.getGeminiKey());

    var npcNames = GMTOOLKIT._moduleData.npcNames;

    app._isGenerating = true;
    await app.render({ force: true });

    var npc = GMTOOLKIT.generateBasicNPC(npcNames);
    if (!npc) {
      ui.notifications.error("NPC name data unavailable.");
      app._isGenerating = false;
      await app.render({ force: true });
      return;
    }

    if (useAI) {
      var aiData = await GMTOOLKIT.enhanceNPCWithAI(npc.name, npc.race, npc.sex);
      if (aiData) {
        /* applyAIEnhancement returns a new merged object — reassign rather than mutate. */
        npc = GMTOOLKIT.applyAIEnhancement(npc, aiData);
      }
      /* If AI fails we still display the basic NPC — no error blocking. */
    }

    app._lastNPC      = npc;
    app._isGenerating = false;
    await app.render({ force: true });
  }

  /** Save NPC to journal. */
  static async _onSaveJournal(event, target) {
    var app = this;
    if (!app._lastNPC) return;

    try {
      var entry = await GMTOOLKIT.saveNPCToJournal(app._lastNPC);
      ui.notifications.info("NPC saved to journal: \"" + entry.name + "\"");
    } catch (err) {
      console.error("PF2e GM Toolkit | Failed to save NPC:", err);
      ui.notifications.error("Failed to save NPC to journal.");
    }
  }

  /** Clear result — also resets archetype selection since the NPC is gone. */
  static async _onClearResult(event, target) {
    var app = this;
    app._lastNPC            = null;
    app._selectedArchetype  = null;
    app._showArchetypePicker = false;
    await app.render({ force: true });
  }

  /** Toggle archetype picker panel open/closed. */
  static async _onToggleArchetypePicker(event, target) {
    var app = this;
    app._showArchetypePicker = !app._showArchetypePicker;
    await app.render({ force: true });
  }

  /**
   * Select an archetype entry from the picker.
   * The data attributes on the button carry packId, actorId, and name —
   * that is the full information needed for createNPCActorFromArchetype().
   */
  static async _onSelectArchetype(event, target) {
    var app = this;
    app._selectedArchetype = {
      packId:  target.dataset.packId,
      actorId: target.dataset.actorId,
      name:    target.dataset.name,
    };
    /* Close the picker after selection so the GM sees the confirmation row. */
    app._showArchetypePicker = false;
    await app.render({ force: true });
  }

  /** Clear the selected archetype without closing any other panel state. */
  static async _onClearArchetype(event, target) {
    var app = this;
    app._selectedArchetype = null;
    await app.render({ force: true });
  }

  /**
   * Apply category/level filter to the archetype list.
   * Reads current form values so the GM does not need to change focus.
   */
  static async _onApplyArchetypeFilter(event, target) {
    var app = this;
    var form = app.element.querySelector("form");
    var cat  = (form && form.querySelector("[name='archetypeCategory']"))
      ? form.querySelector("[name='archetypeCategory']").value
      : "";
    var lvlRaw = (form && form.querySelector("[name='creatureLevel']"))
      ? form.querySelector("[name='creatureLevel']").value
      : "";
    var lvl = parseInt(lvlRaw, 10);

    app._archetypeCategory = cat;
    if (!isNaN(lvl) && lvl >= 1 && lvl <= 20) app._creatureLevel = lvl;
    await app.render({ force: true });
  }

  /**
   * Create a Foundry Actor from the current NPC profile.
   *
   * If the GM selected an archetype, we import that compendium document as
   * the mechanical base and overlay only name + biography (risk-mitigated
   * approach — see actor-creator.js for the full rationale).
   *
   * If no archetype was selected, we create a stat-less actor so the GM
   * still gets the name and biography without any broken stat block.
   *
   * After creation we open the actor sheet so the GM can review and tweak.
   */
  static async _onCreateActor(event, target) {
    var app = this;
    if (!app._lastNPC) return;

    try {
      var actor;
      if (app._selectedArchetype) {
        actor = await GMTOOLKIT.createNPCActorFromArchetype(app._lastNPC, app._selectedArchetype);
      } else {
        actor = await GMTOOLKIT.createBasicNPCActorNoArchetype(app._lastNPC);
      }

      if (actor) {
        ui.notifications.info("PF2e GM Toolkit | Created actor: \"" + actor.name + "\"");
        /* Open the sheet so the GM can inspect and refine immediately. */
        if (actor.sheet) actor.sheet.render(true);
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | Actor creation failed:", err);
      ui.notifications.error("Actor creation failed: " + err.message);
    }
  }
}
