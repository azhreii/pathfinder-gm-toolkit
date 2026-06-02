import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), `${label} should include ${needle}`);
}

function assertExcludes(text, needle, label) {
  assert(!text.includes(needle), `${label} should not include ${needle}`);
}

const moduleJson = JSON.parse(read("module.json"));
const main = read("scripts/main.js");
const sidebarScript = read("scripts/toolkit-sidebar-tab.js");
const sidebarTemplate = read("templates/toolkit-sidebar.hbs");
const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

const sidebarScriptIndex = moduleJson.scripts.indexOf("scripts/toolkit-sidebar-tab.js");
const mainScriptIndex = moduleJson.scripts.indexOf("scripts/main.js");
assert(sidebarScriptIndex !== -1, "module.json should load scripts/toolkit-sidebar-tab.js");
assert(mainScriptIndex !== -1, "module.json should load scripts/main.js");
assert(sidebarScriptIndex < mainScriptIndex, "toolkit-sidebar-tab.js should load before main.js");

assertExcludes(main, "renderJournalDirectory", "scripts/main.js");
assertExcludes(main, "gmt-sidebar-btn", "scripts/main.js");
assertExcludes(main, "gmt-sidebar-buttons", "scripts/main.js");
assertIncludes(main, "GMToolkitSidebarTab.register()", "scripts/main.js");

assertIncludes(sidebarScript, "class GMToolkitSidebarTab", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "HandlebarsApplicationMixin", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "AbstractSidebarTab", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "static tabName = \"gmtoolkit\"", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "Sidebar.TABS.gmtoolkit", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "CONFIG.ui.gmtoolkit", "scripts/toolkit-sidebar-tab.js");
assertIncludes(sidebarScript, "gmOnly: true", "scripts/toolkit-sidebar-tab.js");

assertIncludes(sidebarTemplate, "data-action=\"openEncounter\"", "templates/toolkit-sidebar.hbs");
assertIncludes(sidebarTemplate, "data-action=\"openNPC\"", "templates/toolkit-sidebar.hbs");

assertExcludes(readme, "Journal sidebar", "README.md");
assertIncludes(readme, "GM Toolkit sidebar tab", "README.md");

console.log("UI surface validation passed.");
