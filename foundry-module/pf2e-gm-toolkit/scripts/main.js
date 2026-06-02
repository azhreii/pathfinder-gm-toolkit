/**
 * Module entry point.
 * Registers settings, loads data, and adds toolbar buttons.
 */

Hooks.once("init", () => {
  /* Register the Gemini API key setting — world-scoped and GM-only. */
  game.settings.register("pf2e-gm-toolkit", "geminiApiKey", {
    name: "Gemini API Key",
    hint: "Optional. Enter your Google Gemini API key to enable AI-enhanced encounters and NPCs. Leave blank to use basic generation only.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    restricted: true, // only GMs can view/edit in settings
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
