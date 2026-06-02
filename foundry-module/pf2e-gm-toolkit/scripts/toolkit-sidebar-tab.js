/**
 * Dedicated PF2e GM Toolkit sidebar tab.
 * Provides a native Foundry launch surface for the module's GM tools.
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
      openEncounter: GMToolkitSidebarTab._onOpenEncounter,
      openNPC:       GMToolkitSidebarTab._onOpenNPC,
    },
  };

  static PARTS = {
    content: {
      template: "modules/pf2e-gm-toolkit/templates/toolkit-sidebar.hbs",
    },
  };

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

  /** Re-render the sidebar tab when async module indexes become available. */
  static refresh() {
    const app = ui?.gmtoolkit;
    if (app?.rendered) app.render({ force: true });
  }

  async _prepareContext(_options) {
    const moduleData = GMTOOLKIT._moduleData;
    const archetypes = GMTOOLKIT._archetypeIndex;

    return {
      dataReady: !!moduleData,
      monsterCount: moduleData?.monsterIndex?.length ?? 0,
      archetypeReady: Array.isArray(archetypes),
      archetypeCount: Array.isArray(archetypes) ? archetypes.length : 0,
      aiEnabled:
        !!(GMTOOLKIT.isAIEnabled && GMTOOLKIT.isAIEnabled()) ||
        !!(GMTOOLKIT.getGeminiKey && GMTOOLKIT.getGeminiKey()),
    };
  }

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
}
