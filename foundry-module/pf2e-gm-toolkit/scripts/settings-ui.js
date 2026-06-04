/**
 * Settings form enhancement — dynamic model picker.
 *
 * Hooks into the rendered SettingsConfig form and replaces the free-text
 * model input with a <select> populated from the provider's model list API.
 *
 * Triggers:
 *   - Provider dropdown change
 *   - API key input blur
 *   - Base URL input blur (openai-compatible only)
 *   - Immediately on open when a provider + key are already saved
 */

Hooks.on("renderSettingsConfig", function (app, html) {
  /* Normalize: Foundry v12 passes a jQuery wrapper; v13 may pass a raw element. */
  var root = (html instanceof HTMLElement) ? html : (html && html[0]);
  if (!root) return;

  /* Bail out if our module's settings are not in this render. */
  var providerEl = root.querySelector('[name="pf2e-gm-toolkit.llmProvider"]');
  if (!providerEl) return;

  var apiKeyEl  = root.querySelector('[name="pf2e-gm-toolkit.llmApiKey"]');
  var baseUrlEl = root.querySelector('[name="pf2e-gm-toolkit.llmBaseUrl"]');
  var modelEl   = root.querySelector('[name="pf2e-gm-toolkit.llmModel"]');
  if (!modelEl) return;

  /* ---- Build the replacement <select> ---- */
  var modelSelect = document.createElement("select");
  modelSelect.name  = modelEl.name;
  modelSelect.style.width = "100%";

  var savedModel = modelEl.value || "";
  _seedSelect(modelSelect, savedModel);
  modelEl.parentNode.replaceChild(modelSelect, modelEl);

  /* Status line shown below the select. */
  var statusEl = document.createElement("p");
  statusEl.className = "hint gmt-model-status";
  statusEl.style.marginTop = "0.2rem";
  modelSelect.parentNode.insertBefore(statusEl, modelSelect.nextSibling);

  /* ---- Fetch and populate ---- */
  async function refreshModels() {
    var provider = providerEl.value || "";
    var apiKey   = apiKeyEl  ? (apiKeyEl.value  || "") : "";
    var baseUrl  = baseUrlEl ? (baseUrlEl.value || "") : "";

    /* Nothing to fetch without at least a provider and a key. */
    if (!provider || !apiKey) {
      _seedSelect(modelSelect, modelSelect.value);
      statusEl.textContent = "";
      return;
    }

    statusEl.textContent = "Fetching available models…";
    modelSelect.disabled = true;

    var models;
    try {
      models = await GMTOOLKIT.fetchAvailableModels(provider, apiKey, baseUrl);
    } catch (err) {
      statusEl.textContent = "Could not fetch models: " + err.message;
      modelSelect.disabled = false;
      return;
    }

    if (!models || models.length === 0) {
      statusEl.textContent = "No models found for this provider/key combination.";
      modelSelect.disabled = false;
      return;
    }

    /* Prefer: saved selection → provider default → first in list. */
    var current      = savedModel || modelSelect.value || "";
    var defaultModel = (GMTOOLKIT.DEFAULT_MODELS && GMTOOLKIT.DEFAULT_MODELS[provider]) || "";
    var toSelect     = current || defaultModel;

    modelSelect.innerHTML = "";
    var matched = false;
    for (var i = 0; i < models.length; i++) {
      var opt = document.createElement("option");
      opt.value       = models[i].id;
      opt.textContent = models[i].id;
      if (models[i].id === toSelect) {
        opt.selected = true;
        matched = true;
      }
      modelSelect.appendChild(opt);
    }

    /* If the saved/default model wasn't in the list, fall back to the first entry. */
    if (!matched && modelSelect.options.length > 0) {
      /* Try the provider default one more time, then first option. */
      var found = false;
      for (var j = 0; j < modelSelect.options.length; j++) {
        if (modelSelect.options[j].value === defaultModel) {
          modelSelect.options[j].selected = true;
          found = true;
          break;
        }
      }
      if (!found) modelSelect.options[0].selected = true;
    }

    /* Update savedModel so subsequent provider changes preserve the new selection. */
    savedModel = modelSelect.value;

    statusEl.textContent = models.length + " model" + (models.length === 1 ? "" : "s") + " available.";
    modelSelect.disabled = false;
  }

  /* Wire up triggers. */
  providerEl.addEventListener("change", refreshModels);
  if (apiKeyEl)  apiKeyEl.addEventListener("blur",   refreshModels);
  if (baseUrlEl) baseUrlEl.addEventListener("blur",  refreshModels);

  /* Auto-fetch if we already have a provider + key saved. */
  if (providerEl.value && apiKeyEl && apiKeyEl.value) {
    refreshModels();
  }
});

/**
 * Seed the select with a single placeholder/current-value option.
 * Called before the model list is fetched so the element is never empty.
 * @param {HTMLSelectElement} select
 * @param {string}            currentValue
 */
function _seedSelect(select, currentValue) {
  select.innerHTML = "";
  var opt = document.createElement("option");
  if (currentValue) {
    opt.value       = currentValue;
    opt.textContent = currentValue;
  } else {
    opt.value       = "";
    opt.textContent = "— set a provider and API key first —";
  }
  opt.selected = true;
  select.appendChild(opt);
}
