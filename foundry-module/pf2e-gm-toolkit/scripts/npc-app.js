/**
 * NPC Generator UI — ApplicationV2 (Foundry v13).
 */

class NPCGeneratorApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
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
      shareNPCNarrative:     NPCGeneratorApp._onShareNPCDetails,
      toggleArchetypePicker: NPCGeneratorApp._onToggleArchetypePicker,
      selectArchetype:       NPCGeneratorApp._onSelectArchetype,
      clearArchetype:        NPCGeneratorApp._onClearArchetype,
      applyArchetypeFilter:  NPCGeneratorApp._onApplyArchetypeFilter,
      /* Merchant / shop system actions */
      enableMerchant:        NPCGeneratorApp._onEnableMerchant,
      clearMerchant:         NPCGeneratorApp._onClearMerchant,
      shopTypeChange:        NPCGeneratorApp._onShopTypeChange,
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
    /* Holds the most recently created Actor document so _onShareNPCDetails
       can offer an actor-bio save if the GM shares after creating an actor. */
    this._createdActor   = null;

    /* Archetype picker state — all start null/false/"" so the picker is
       hidden until the GM explicitly requests it. */
    this._creatureLevel      = null;   // null = auto-detect from party
    this._selectedArchetype  = null;   // { packId, actorId, name } or null
    this._showArchetypePicker = false;
    this._archetypeCategory  = "";     // filter: "" = All

    /* Merchant / shop system state.
       _shopType is null when the NPC is not a merchant; set to a SHOP_TYPES key
       when the GM clicks "Make Merchant".  The other two fields control inventory
       generation parameters and default to sensible mid-range values. */
    this._shopType     = null;          // null = not a merchant
    this._wealthTier   = "standard";    // 'poor' | 'standard' | 'wealthy' | 'elite'
    this._locationSize = "town";        // 'village' | 'town' | 'city'
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

    /* Fetch filtered archetypes then sort: NPC Gallery before bestiary,
       then by level ascending, then alphabetically by name.
       Cap at 60 after sorting so the priority entries are not cut off. */
    var archetypes = (GMTOOLKIT.getArchetypesForLevel &&
      GMTOOLKIT.getArchetypesForLevel(effectiveLevel, this._archetypeCategory || null)) || [];

    archetypes = archetypes.slice().sort(function (a, b) {
      /* Primary: NPC Gallery entries float to the top of the list. */
      var aIsGallery = a.source === "npc-gallery" ? 0 : 1;
      var bIsGallery = b.source === "npc-gallery" ? 0 : 1;
      if (aIsGallery !== bIsGallery) return aIsGallery - bIsGallery;
      /* Secondary tiebreaker: level ascending. */
      if (a.level !== b.level) return a.level - b.level;
      /* Tertiary tiebreaker: name alphabetically. */
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

    /* Map effective level to a GM-readable role hint.
       PF2e creatures can be level -1 or 0 for ordinary folk. */
    var levelRole;
    if (effectiveLevel <= 0) {
      levelRole = "Ordinary adult (farmer, laborer, townsperson)";
    } else if (effectiveLevel <= 2) {
      levelRole = "Trained professional (guard, craftsperson, merchant)";
    } else if (effectiveLevel <= 5) {
      levelRole = "Exceptional individual (veteran, expert, minor mage)";
    } else {
      levelRole = "Powerful figure (captain, master mage, crime lord)";
    }

    /* Build the shop type options list from GMTOOLKIT.SHOP_TYPES (constants.js).
       Falls back to empty array if shop-logic.js hasn't loaded yet. */
    var shopTypeOptions = Object.entries(GMTOOLKIT.SHOP_TYPES || {}).map(function (pair) {
      return { value: pair[0], label: pair[1] };
    });

    return {
      npc:          this._lastNPC,
      isGenerating: this._isGenerating,
      hasResult:    !!this._lastNPC,

      hasGeminiKey: GMTOOLKIT.isAIEnabled(),

      /* Archetype picker context fields. */
      detectedLevel:       detectedLevel,
      effectiveLevel:      effectiveLevel,
      usingDetected:       usingDetected,
      levelRole:           levelRole,
      archetypes:          archetypes.slice(0, 60),
      archetypeCategories: categories,
      selectedArchetype:   this._selectedArchetype,
      showArchetypePicker: this._showArchetypePicker,
      archetypeCategory:   this._archetypeCategory,
      archetypeIndexReady: Array.isArray(GMTOOLKIT._archetypeIndex),

      /* Merchant / shop system context fields. */
      shopType:        this._shopType,
      shopTypeOptions: shopTypeOptions,
      wealthTier:      this._wealthTier,
      locationSize:    this._locationSize,
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
        /* Accept -1 through 20 — PF2e uses -1 and 0 for ordinary folk.
           Anything outside that range or NaN reverts to auto-detect. */
        app._creatureLevel = (!isNaN(v) && v >= -1 && v <= 20) ? v : null;
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
    var useAI = data.get("useAI") === "on" && GMTOOLKIT.isAIEnabled();

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

    /* Push a session history entry so the sidebar cockpit can show recent NPCs. */
    GMTOOLKIT._sessionHistory = GMTOOLKIT._sessionHistory || [];
    GMTOOLKIT._sessionHistory.unshift({
      type:      "npc",
      name:      npc.name,
      timestamp: Date.now(),
      ref:       { npc: npc },
    });
    /* Keep the history cap at 5 entries so it doesn't grow unbounded. */
    if (GMTOOLKIT._sessionHistory.length > 5) GMTOOLKIT._sessionHistory.pop();
    /* Refresh the sidebar tab if it is open — safe no-op if it isn't. */
    if (typeof GMToolkitSidebarTab !== "undefined" && GMToolkitSidebarTab.refresh) {
      GMToolkitSidebarTab.refresh();
    }

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

  /** Clear result — also resets archetype selection, created actor reference, and merchant state. */
  static async _onClearResult(event, target) {
    var app = this;
    app._lastNPC             = null;
    app._selectedArchetype   = null;
    app._showArchetypePicker = false;
    /* Clear the actor reference so a stale actor isn't used by a future Share call. */
    app._createdActor        = null;
    /* Reset merchant state so the next generated NPC starts fresh. */
    app._shopType            = null;
    app._wealthTier          = "standard";
    app._locationSize        = "town";
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
   * Share NPC details via the share infrastructure.
   *
   * Posts a GM-only whisper with the full NPC profile (including motivation
   * and secret) plus a "Share with players" button that posts only the
   * flavor subset (appearance, personality, quote — no secrets or motivation).
   *
   * Save target is 'both' when an archetype was selected (actor bio + journal),
   * 'journal' otherwise.  Actor bio save only fires if an actor was created
   * this session and is available via app._createdActor.
   *
   * Guarded with a GMTOOLKIT.shareContent existence check so the button is
   * a no-op rather than an error if gm-share.js failed to load.
   */
  static async _onShareNPCDetails(event, target) {
    var app = this;
    if (!app._lastNPC) return;

    if (!GMTOOLKIT.shareContent) {
      console.warn("PF2e GM Toolkit | shareContent not available — gm-share.js may not be loaded.");
      ui.notifications.warn("GM Toolkit: Share infrastructure not loaded.");
      return;
    }

    var npc = app._lastNPC;

    /* Build the full GM-facing text (all fields). */
    var textLines = [];
    if (npc.appearance)  textLines.push("<p><strong>Appearance:</strong> "  + npc.appearance  + "</p>");
    if (npc.personality) textLines.push("<p><strong>Personality:</strong> " + npc.personality + "</p>");
    if (npc.occupation)  textLines.push("<p><strong>Occupation:</strong> "  + npc.occupation  + "</p>");
    if (npc.motivation)  textLines.push("<p><strong>Motivation:</strong> "  + npc.motivation  + "</p>");
    if (npc.secret)      textLines.push("<p><strong>Secret:</strong> "      + npc.secret      + "</p>");
    if (npc.quote)       textLines.push("<p><em>\"" + npc.quote + "\"</em></p>");

    var formattedText = textLines.length
      ? textLines.join("\n")
      : "<p>" + npc.name + " — " + npc.race + " " + npc.sex + "</p>";

    /* If an archetype was selected and an actor was already created this session,
       offer to update the actor bio as well.  app._createdActor is set by
       _onCreateActor when creation succeeds. */
    var saveTarget = app._selectedArchetype ? "both" : "journal";
    var actorArg   = (saveTarget === "both" && app._createdActor) ? app._createdActor : null;

    await GMTOOLKIT.shareContent({
      text:       formattedText,
      title:      npc.name,
      type:       "npc",
      saveTarget: saveTarget,
      actor:      actorArg,
      npc:        npc,
    });
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
    /* Accept -1 through 20 — PF2e uses -1 and 0 for ordinary folk. */
    if (!isNaN(lvl) && lvl >= -1 && lvl <= 20) app._creatureLevel = lvl;
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
   * When merchant mode is active (_shopType is set), generateShopInventory()
   * is called and the resulting item index entries are passed to the creator
   * functions, which embed the full compendium documents into the new actor.
   *
   * After the base inventory is embedded, if AI is enabled an optional
   * specialty item is requested via generateSpecialtyItem() and added as a
   * plain "equipment" document.  Failure of the AI call does NOT block the
   * rest of actor creation — it is fully isolated in its own try/catch.
   *
   * After creation we open the actor sheet so the GM can review and tweak.
   */
  static async _onCreateActor(event, target) {
    var app = this;
    if (!app._lastNPC) return;

    try {
      /* ---- Step 1: Build inventory if merchant mode is active ---- */
      var inventory = [];
      if (app._shopType) {
        var form         = app.element.querySelector("form");
        /* Read wealth/location from the live form — fall back to app state defaults. */
        var wealthTier   = (form && form.querySelector("[name='wealthTier']"))
          ? form.querySelector("[name='wealthTier']").value
          : app._wealthTier;
        var locationSize = (form && form.querySelector("[name='locationSize']"))
          ? form.querySelector("[name='locationSize']").value
          : app._locationSize;
        /* Use detected party level or fall back to 5 (a reasonable mid-game default). */
        var partyLevel   = (GMTOOLKIT.detectParty && GMTOOLKIT.detectParty().partyLevel) || 5;

        inventory = GMTOOLKIT.generateShopInventory(app._shopType, partyLevel, wealthTier, locationSize);
      }

      /* ---- Step 2: Create the actor (with embedded inventory) ---- */
      var actor;
      if (app._selectedArchetype) {
        actor = await GMTOOLKIT.createNPCActorFromArchetype(app._lastNPC, app._selectedArchetype, inventory);
      } else {
        actor = await GMTOOLKIT.createBasicNPCActorNoArchetype(app._lastNPC, inventory);
      }

      if (actor) {
        /* Store the created actor so _onShareNPCDetails can reference it
           if the GM clicks Share after creating the actor in the same session. */
        app._createdActor = actor;

        /* ---- Step 3: Optional AI specialty item (non-blocking) ---- */
        if (app._shopType && GMTOOLKIT.isAIEnabled && GMTOOLKIT.isAIEnabled()) {
          /* Wrapped in its own try/catch — specialty item failure must not surface
             as an error to the GM; actor creation already succeeded at this point. */
          try {
            var specialty = await GMTOOLKIT.generateSpecialtyItem(
              app._shopType,
              app._lastNPC.name,
              app._lastNPC.occupation
            );

            if (specialty) {
              /* Add as a minimal PF2e "equipment" item.
                 Only the fields PF2e absolutely requires are set — extra fields
                 risk schema validation errors that would silently drop the item. */
              await actor.createEmbeddedDocuments("Item", [{
                name: specialty.name,
                type: "equipment",
                system: {
                  description: {
                    value: "<p><em>[AI-generated]</em> " + specialty.description + "</p>",
                  },
                  quantity: { value: 1 },
                  level:    { value: specialty.level || 1 },
                },
              }]);

              /* Whisper the specialty item details to the GM via the share infrastructure. */
              if (GMTOOLKIT.shareContent) {
                GMTOOLKIT.shareContent({
                  text:  specialty.name + "\n\n" + specialty.description + "\n\nPrice: " + specialty.price,
                  title: app._lastNPC.name + "'s Special Wares",
                  type:  "generic",
                  saveTarget: "none",
                });
              }
            }
          } catch (specialtyErr) {
            /* Log but swallow — inventory already in place, no need to alarm the GM. */
            console.error("PF2e GM Toolkit | Specialty item generation failed (non-blocking):", specialtyErr);
          }
        }

        /* ---- Step 4: Notification + sheet open ---- */
        var itemCount = inventory.length;
        var msg = itemCount > 0
          ? "Created actor \"" + actor.name + "\" with " + itemCount + " inventory items"
          : "Created actor \"" + actor.name + "\"";
        ui.notifications.info("PF2e GM Toolkit | " + msg);

        /* Open the sheet so the GM can inspect and refine immediately. */
        if (actor.sheet) actor.sheet.render(true);

        /* ---- Step 5: Write AI flavor text into biography (existing behaviour) ----
           Route through shareContent so save logic stays in one place.
           Guard against gm-share.js not being loaded (load-order safety). */
        if (app._lastNPC && app._lastNPC.aiEnhanced && GMTOOLKIT.shareContent) {
          var npc = app._lastNPC;
          var bioBlock = "";
          if (npc.appearance)  bioBlock += "<p><strong>Appearance:</strong> " + npc.appearance  + "</p>\n";
          if (npc.personality) bioBlock += "<p><strong>Personality:</strong> " + npc.personality + "</p>\n";
          if (npc.occupation)  bioBlock += "<p><strong>Occupation:</strong> "  + npc.occupation  + "</p>\n";
          if (npc.motivation)  bioBlock += "<p><strong>Motivation:</strong> "  + npc.motivation  + "</p>\n";
          if (npc.secret)      bioBlock += "<p><strong>Secret:</strong> "      + npc.secret      + "</p>\n";
          if (npc.quote)       bioBlock += "<p><em>\"" + npc.quote + "\"</em></p>\n";

          if (bioBlock) {
            await GMTOOLKIT.shareContent({
              text:       bioBlock,
              title:      npc.name,
              type:       "npc",
              saveTarget: "actor-bio",
              actor:      actor,
              npc:        npc,
            });
          }
        }
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | Actor creation failed:", err);
      ui.notifications.error("Actor creation failed: " + err.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Merchant action handlers                                             */
  /* ------------------------------------------------------------------ */

  /**
   * "Make Merchant" button handler.
   * Infers a shop type from the NPC's occupation via inferShopType().
   * Defaults to 'general' if no keyword match is found.
   * Re-renders so the merchant controls section becomes visible.
   */
  static async _onEnableMerchant(event, target) {
    var app = this;
    if (!app._lastNPC) return;

    var inferred = GMTOOLKIT.inferShopType
      ? GMTOOLKIT.inferShopType(app._lastNPC.occupation)
      : null;
    /* Fall back to 'general' if no keyword matched the occupation. */
    app._shopType = inferred || "general";
    await app.render({ force: true });
  }

  /**
   * "Remove Merchant" button handler.
   * Clears merchant mode so the NPC is treated as a plain NPC again.
   */
  static async _onClearMerchant(event, target) {
    var app = this;
    app._shopType = null;
    await app.render({ force: true });
  }

  /**
   * Shop type select change handler.
   * The select element fires a data-action="shopTypeChange" event on change.
   * We read the live value from the form element and update app state.
   */
  static async _onShopTypeChange(event, target) {
    var app = this;
    /* target is the <select> element that fired the action. */
    var newType = target.value || "general";
    /* Only accept known shop types — reject arbitrary strings. */
    if (GMTOOLKIT.SHOP_TYPES && GMTOOLKIT.SHOP_TYPES[newType]) {
      app._shopType = newType;
    }
    await app.render({ force: true });
  }
}
