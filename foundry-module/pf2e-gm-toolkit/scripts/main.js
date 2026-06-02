/**
 * Module entry point.
 * Registers settings, loads data, and adds toolbar buttons.
 */

Hooks.once("init", () => {
  /*
   * AI / LLM provider settings — world-scoped and GM-only.
   *
   * Four settings replace the old single geminiApiKey field so that the module
   * can talk to any OpenAI-compatible endpoint, not just Gemini.
   *
   * llmProvider  — which provider (or blank = disabled)
   * llmModel     — model name override (blank = use provider default)
   * llmApiKey    — the API key for that provider
   * llmBaseUrl   — base URL for openai-compatible self-hosted endpoints only
   */

  game.settings.register("pf2e-gm-toolkit", "llmProvider", {
    name: "AI Provider",
    hint: "Select your AI provider. Leave blank to disable AI features entirely.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "":                  "Disabled",
      gemini:              "Google Gemini",
      openai:              "OpenAI",
      mistral:             "Mistral",
      "openai-compatible": "Custom (OpenAI-compatible)",
    },
    default: "",
    restricted: true,
  });

  game.settings.register("pf2e-gm-toolkit", "llmModel", {
    name: "Model",
    hint: "Model name (e.g. gpt-4o, gemini-2.0-flash, mistral-large-latest). Leave blank to use the provider default.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    restricted: true,
  });

  game.settings.register("pf2e-gm-toolkit", "llmApiKey", {
    name: "API Key",
    hint: "Your API key for the selected provider. Stored as part of your world data — treat world backups with the same care as this key.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    restricted: true,
  });

  game.settings.register("pf2e-gm-toolkit", "llmBaseUrl", {
    name: "Custom Endpoint URL",
    hint: "For Custom (OpenAI-compatible) providers only. Example: http://localhost:11434. Omit trailing slash.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    restricted: true,
  });

  console.log("PF2e GM Toolkit | Initialized");
});

Hooks.once("ready", async () => {
  /*
   * Two-phase load:
   * 1. Fetch the small bundled JSON files (terrain rules, NPC names) — fast.
   * 2. Build the monster index from Foundry's own compendium packs — slower
   *    but picks up every bestiary book the GM has installed automatically.
   */
  try {
    const { terrainMapping, npcNames } = await GMTOOLKIT.loadModuleData();

    ui.notifications.info("PF2e GM Toolkit: indexing monsters from compendiums…", { permanent: false });
    const monsterIndex = await GMTOOLKIT.buildMonsterIndex();

    GMTOOLKIT._moduleData = { monsterIndex, terrainMapping, npcNames };
    console.log(
      `PF2e GM Toolkit | Ready — ${monsterIndex.length} monsters indexed from ${game.packs.size} packs`
    );

    /* Build NPC archetype index in the background — used by the archetype picker.
     * Non-critical: if this fails the picker shows "no archetypes found" gracefully. */
    GMTOOLKIT.buildArchetypeIndex().then((index) => {
      GMTOOLKIT._archetypeIndex = index;
      console.log(`PF2e GM Toolkit | ${index.length} NPC archetypes indexed`);
    }).catch((err) => {
      console.warn("PF2e GM Toolkit | Archetype index failed:", err);
      GMTOOLKIT._archetypeIndex = [];
    });
  } catch (err) {
    console.error("PF2e GM Toolkit | Failed to load module data:", err);
    ui.notifications.error("PF2e GM Toolkit: failed to load data. Check the console.");
  }
});

/**
 * Add GM Toolkit buttons to the Journal sidebar header.
 * Using renderJournalDirectory is reliable across v12/v13 and avoids
 * canvas-layer requirements that scene controls impose on custom groups.
 */
Hooks.on("renderJournalDirectory", (app, [html]) => {
  if (!game.user.isGM) return;

  /* Avoid adding duplicate buttons on re-render. */
  if (html.querySelector(".gmt-sidebar-btn")) return;

  const header = html.querySelector(".directory-header") ?? html.querySelector("header");
  if (!header) return;

  const wrapper = document.createElement("div");
  wrapper.classList.add("gmt-sidebar-buttons");
  wrapper.innerHTML = `
    <button class="gmt-sidebar-btn" title="Encounter Builder" data-gmt="encounter">
      <i class="fas fa-swords"></i> Encounters
    </button>
    <button class="gmt-sidebar-btn" title="NPC Generator" data-gmt="npc">
      <i class="fas fa-user-secret"></i> NPCs
    </button>
  `;

  header.after(wrapper);

  wrapper.querySelector("[data-gmt='encounter']").addEventListener("click", () => {
    /* Bring to front if already open, otherwise open fresh. */
    const existing = foundry.applications.instances.get("pf2e-gm-toolkit-encounter");
    if (existing) existing.bringToFront();
    else new EncounterBuilderApp().render(true);
  });

  wrapper.querySelector("[data-gmt='npc']").addEventListener("click", () => {
    const existing = foundry.applications.instances.get("pf2e-gm-toolkit-npc");
    if (existing) existing.bringToFront();
    else new NPCGeneratorApp().render(true);
  });
});
