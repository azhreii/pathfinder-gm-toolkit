/**
 * Multi-provider AI helpers for PF2e GM Toolkit.
 *
 * Supported providers:
 *   gemini           — Google Gemini REST API
 *   openai           — OpenAI chat completions
 *   mistral          — Mistral chat completions (same wire format as OpenAI)
 *   openai-compatible — Any endpoint that speaks the OpenAI chat completions
 *                       format; base URL comes from the llmBaseUrl setting.
 *
 * All provider calls are wrapped in try/catch and return null on any failure.
 * Errors are logged with the "PF2e GM Toolkit |" prefix so they are easy to
 * filter in the Foundry console.
 *
 * Public surface (attached to GMTOOLKIT global):
 *   getLLMConfig()
 *   isAIEnabled()
 *   sanitizeLoreText(text)
 *   callLLM(prompt)
 *   enhanceNPCWithAI(name, race, sex)        — existing signature preserved
 *   enhanceEncounterWithAI(terrain, templateName, monsters) — same
 *   getGeminiKey()                           — deprecated shim; kept for
 *                                              backwards compat with apps that
 *                                              have not yet migrated to isAIEnabled()
 */

/* ------------------------------------------------------------------ */
/* Module-level constants                                               */
/* ------------------------------------------------------------------ */

/** Gemini generateContent REST endpoint (model name injected at call time). */
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** OpenAI-format endpoint URLs for hosted providers. */
const OPENAI_URL  = "https://api.openai.com/v1/chat/completions";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/* ------------------------------------------------------------------ */
/* Config and feature-flag helpers                                      */
/* ------------------------------------------------------------------ */

/**
 * Read all LLM-related settings in one shot.
 * Returns safe defaults if settings are not yet registered (e.g. during early
 * module load) rather than throwing into the caller.
 *
 * @returns {{ provider: string, model: string, apiKey: string, baseUrl: string }}
 */
GMTOOLKIT.getLLMConfig = function () {
  try {
    const provider = game.settings.get("pf2e-gm-toolkit", "llmProvider") || "";
    const model    = game.settings.get("pf2e-gm-toolkit", "llmModel")    || "";
    const apiKey   = game.settings.get("pf2e-gm-toolkit", "llmApiKey")   || "";
    const baseUrl  = game.settings.get("pf2e-gm-toolkit", "llmBaseUrl")  || "";

    /* If the user left the model field blank, fall back to the provider default
     * defined in constants.js.  If there is no default either, resolved stays "". */
    const resolved = model || GMTOOLKIT.DEFAULT_MODELS?.[provider] || "";

    return { provider, model: resolved, apiKey, baseUrl };
  } catch {
    /* Settings not yet registered or game not ready — return safe no-op state. */
    return { provider: "", model: "", apiKey: "", baseUrl: "" };
  }
};

/**
 * Returns true when both a provider and an API key are configured.
 * Use this as the single gate before showing AI buttons or calling callLLM().
 *
 * @returns {boolean}
 */
GMTOOLKIT.isAIEnabled = function () {
  const { provider, apiKey } = GMTOOLKIT.getLLMConfig();
  return Boolean(provider && apiKey);
};

/**
 * Deprecated — kept so that encounter-app.js and npc-app.js can continue to
 * call GMTOOLKIT.getGeminiKey() until they are updated to use isAIEnabled().
 *
 * Returns the stored API key when the selected provider is "gemini", otherwise
 * returns null.  Code that only checked for a truthy return value to decide
 * whether AI is enabled will still work correctly for the gemini provider.
 *
 * @deprecated Use GMTOOLKIT.getLLMConfig() or GMTOOLKIT.isAIEnabled() instead.
 * @returns {string|null}
 */
GMTOOLKIT.getGeminiKey = function () {
  /* Deprecated — use getLLMConfig(). */
  const cfg = GMTOOLKIT.getLLMConfig();
  return cfg.provider === "gemini" ? cfg.apiKey : null;
};

/* ------------------------------------------------------------------ */
/* Input sanitization                                                   */
/* ------------------------------------------------------------------ */

/**
 * Strip C0 control characters from a string before embedding it in an LLM
 * prompt.  Allows tab (0x09), newline (0x0A), and carriage return (0x0D)
 * because those are intentional whitespace in multi-line prompts.
 * Truncates to 2000 characters so a single user-supplied field cannot blow
 * out the context window.
 *
 * @param {string} text
 * @returns {string}
 */
GMTOOLKIT.sanitizeLoreText = function (text) {
  if (!text) return "";

  /* Remove codepoints 0x00–0x1F except 0x09 (tab), 0x0A (LF), 0x0D (CR). */
  const cleaned = String(text).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  /* Truncate — 2000 chars is a generous excerpt; prompts have their own budget. */
  return cleaned.slice(0, 2000);
};

/* ------------------------------------------------------------------ */
/* JSON cleanup utility                                                 */
/* ------------------------------------------------------------------ */

/**
 * Strip markdown code fences that some models wrap JSON responses in.
 * Matches the Python _clean_json_response() behaviour.
 *
 * @param {string} text  Raw model output
 * @returns {string}     Cleaned string ready for JSON.parse()
 */
function _cleanJsonResponse(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Internal provider implementations                                    */
/* ------------------------------------------------------------------ */

/**
 * Call any endpoint that speaks the OpenAI chat completions wire format.
 * This covers openai, mistral, and openai-compatible providers — they all
 * accept the same request body and return the same response shape.
 *
 * Requests json_object response_format so the model is instructed to return
 * valid JSON directly; the _cleanJsonResponse fence-stripping is still applied
 * as a defensive measure in case the model ignores the hint.
 *
 * @param {string} prompt
 * @param {string} url     Full completions endpoint URL
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<object>}  Parsed JSON object
 * @throws {Error}             On HTTP error or JSON parse failure
 */
async function _callOpenAIFormat(prompt, url, apiKey, model) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      /* json_object mode signals the model to return valid JSON.
       * Not all openai-compatible servers honour this, but it never hurts. */
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    /* Pull the error body for a more useful log message. */
    const errText = await resp.text().catch(() => "(no body)");
    throw new Error(`HTTP ${resp.status}: ${errText}`);
  }

  const data = await resp.json();

  /* Standard OpenAI response shape — content lives here. */
  const text = data?.choices?.[0]?.message?.content ?? "";
  return JSON.parse(_cleanJsonResponse(text));
}

/**
 * Call the Google Gemini generateContent REST endpoint.
 * Gemini uses a different request/response shape from the OpenAI format,
 * so it gets its own implementation.
 *
 * @param {string} prompt
 * @param {string} apiKey
 * @param {string} model   Full model name, e.g. "gemini-2.0-flash"
 * @returns {Promise<object>}
 * @throws {Error}
 */
async function _callGemini(prompt, apiKey, model) {
  /* API key is passed as a query parameter for the Gemini REST API. */
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    /* 2048 tokens gives the encounter prompt (5 multi-sentence fields) room to
       complete without truncation.  1024 was too small and caused JSON parse
       failures on longer responses ("Unterminated string" errors). */
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "(no body)");
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  /* Gemini nests the text inside candidates[0].content.parts[0].text. */
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return JSON.parse(_cleanJsonResponse(raw));
}

/* ------------------------------------------------------------------ */
/* Unified entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Send a prompt to whichever AI provider is currently configured and return
 * the parsed JSON response object.
 *
 * Returns null (without throwing) in every failure case:
 *   - AI is disabled (no provider or no key)
 *   - Unknown provider value
 *   - Network error
 *   - Non-2xx HTTP response
 *   - Response is not valid JSON
 *
 * @param {string} prompt  The full prompt string to send.
 * @returns {Promise<object|null>}
 */
GMTOOLKIT.callLLM = async function (prompt) {
  const { provider, model, apiKey, baseUrl } = GMTOOLKIT.getLLMConfig();

  /* Guard: both provider and key must be present. */
  if (!provider || !apiKey) return null;

  try {
    switch (provider) {

      case "openai":
        /* Hosted OpenAI — fixed endpoint URL. */
        return await _callOpenAIFormat(prompt, OPENAI_URL, apiKey, model);

      case "mistral":
        /* Mistral — same wire format as OpenAI, different base URL. */
        return await _callOpenAIFormat(prompt, MISTRAL_URL, apiKey, model);

      case "openai-compatible": {
        /* User-supplied base URL; append the standard completions path. */
        if (!baseUrl) {
          console.warn("PF2e GM Toolkit | openai-compatible provider selected but llmBaseUrl is empty.");
          return null;
        }
        /* Strip any trailing slash so we never produce a double slash. */
        const cleanBase = baseUrl.replace(/\/$/, "");
        return await _callOpenAIFormat(prompt, `${cleanBase}/v1/chat/completions`, apiKey, model);
      }

      case "gemini":
        return await _callGemini(prompt, apiKey, model);

      default:
        console.warn(`PF2e GM Toolkit | Unknown llmProvider value: "${provider}"`);
        return null;
    }
  } catch (err) {
    console.warn("PF2e GM Toolkit | LLM call failed:", err.message);
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* High-level feature functions (called by encounter-app / npc-app)    */
/* ------------------------------------------------------------------ */

/**
 * Ask the configured AI provider for richer NPC details.
 * Returns an object with appearance, personality, occupation, motivation,
 * secret, and quote — or null on any failure.
 *
 * Existing callers pass (name, race, sex) and check the return value for
 * null, so this signature is unchanged from the original Gemini-only version.
 *
 * @param {string} name
 * @param {string} race
 * @param {string} sex
 * @returns {Promise<object|null>}
 */
GMTOOLKIT.enhanceNPCWithAI = async function (name, race, sex) {
  /* isAIEnabled() is the canonical check; also provides a fast path out. */
  if (!GMTOOLKIT.isAIEnabled()) return null;

  /* Sanitize user-visible strings before embedding them in the prompt
   * so that stray control characters cannot corrupt the request body. */
  const safeName = GMTOOLKIT.sanitizeLoreText(name);
  const safeRace = GMTOOLKIT.sanitizeLoreText(race);
  const safeSex  = GMTOOLKIT.sanitizeLoreText(sex);

  const prompt = `You are a Pathfinder 2e game master creating a memorable NPC.

Given this basic information:
- Name: ${safeName}
- Race: ${safeRace}
- Sex: ${safeSex}

Generate detailed narrative content for this NPC. Respond ONLY with valid JSON in this exact format:
{
  "appearance": "2-3 sentence physical description",
  "personality": "2-3 sentence personality description with a distinctive quirk or mannerism",
  "occupation": "a specific occupation that fits this character",
  "motivation": "their primary goal or driving force",
  "secret": "an interesting secret or hidden aspect",
  "quote": "a memorable thing they might say"
}

Make the NPC interesting and memorable. Be specific and creative.`;

  /* callLLM handles all error logging and returns null on failure. */
  const result = await GMTOOLKIT.callLLM(prompt);
  if (!result) {
    console.warn("PF2e GM Toolkit | NPC AI enhancement returned null.");
  }
  return result;
};

/**
 * Ask the configured AI provider for encounter narrative.
 * Returns an object with setting_description, monster_description,
 * encounter_hook, tactical_notes, battle_map_details — or null on failure.
 *
 * Existing callers pass (terrain, templateName, monsters) where monsters is
 * an array of {name, level} objects.  Signature unchanged.
 *
 * @param {string} terrain       Terrain key (e.g. "forest")
 * @param {string} templateName  Human-readable template label
 * @param {Array}  monsters      [{name: string, level: number}, ...]
 * @returns {Promise<object|null>}
 */
GMTOOLKIT.enhanceEncounterWithAI = async function (terrain, templateName, monsters) {
  if (!GMTOOLKIT.isAIEnabled()) return null;

  /* Resolve the human-readable terrain label for the prompt. */
  const terrainLabel = GMTOOLKIT.TERRAIN_LABELS[terrain] ?? GMTOOLKIT.sanitizeLoreText(terrain);

  /* Build the monster list; sanitize each name in case compendium data is odd. */
  const monsterList = monsters
    .map((m) => `- ${GMTOOLKIT.sanitizeLoreText(m.name)} (Level ${Number(m.level)})`)
    .join("\n");

  const prompt = `You are a Pathfinder 2e game master creating a memorable combat encounter.

Given this encounter setup:
Terrain: ${terrainLabel}
Encounter Type: ${GMTOOLKIT.sanitizeLoreText(templateName)}
Monsters:
${monsterList}

Generate vivid narrative content for this encounter. Respond ONLY with valid JSON in this exact format, no other text:
{
  "setting_description": "3-5 sentence vivid description of the environment and atmosphere",
  "monster_description": "3-5 sentences describing what the monsters look like and how they're positioned/behaving",
  "encounter_hook": "Why are these creatures here? What's the situation the party is walking into?",
  "tactical_notes": "1-2 interesting terrain features or tactical elements that make this fight memorable",
  "battle_map_details": "Specific battle map setup: approximate dimensions (e.g., 30x40 feet), key terrain features and their positions, elevation changes, cover locations, and suggested monster starting positions."
}

Make it atmospheric and specific to the terrain and creatures. Avoid generic descriptions.`;

  const result = await GMTOOLKIT.callLLM(prompt);
  if (!result) {
    console.warn("PF2e GM Toolkit | Encounter AI enhancement returned null.");
  }
  return result;
};

/* ------------------------------------------------------------------ */
/* Model discovery — used by the settings UI model picker              */
/* ------------------------------------------------------------------ */

/**
 * Fetch the list of text-generation models available from the configured
 * provider.  Returns an array of { id } objects sorted alphabetically.
 * Throws on HTTP error so the caller (settings-ui.js) can surface the
 * failure to the user rather than silently doing nothing.
 *
 * @param {string} provider  "gemini" | "openai" | "mistral" | "openai-compatible"
 * @param {string} apiKey
 * @param {string} baseUrl   Required only for "openai-compatible"
 * @returns {Promise<Array<{id: string}>>}
 */
GMTOOLKIT.fetchAvailableModels = async function (provider, apiKey, baseUrl) {
  switch (provider) {
    case "gemini":
      return await _fetchGeminiModels(apiKey);
    case "openai":
      return await _fetchOpenAIStyleModels("https://api.openai.com", apiKey, "openai");
    case "mistral":
      return await _fetchOpenAIStyleModels("https://api.mistral.ai", apiKey, "mistral");
    case "openai-compatible": {
      if (!baseUrl) throw new Error("Custom Endpoint URL is required for openai-compatible provider.");
      return await _fetchOpenAIStyleModels(baseUrl.replace(/\/$/, ""), apiKey, "generic");
    }
    default:
      return [];
  }
};

/**
 * Fetch Gemini models that support text generation.
 * @param {string} apiKey
 * @returns {Promise<Array<{id: string}>>}
 */
async function _fetchGeminiModels(apiKey) {
  /* GEMINI_API_BASE ends with "/models" — strip it to get the base, then re-append
     the models list path.  The list endpoint is the same path without a model name. */
  const url = `${GEMINI_API_BASE}?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return (data.models || [])
    /* Only models that support generateContent are useful here. */
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    /* Strip the "models/" prefix Gemini uses in its name field. */
    .map((m) => ({ id: m.name.replace(/^models\//, "") }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Fetch models from any OpenAI-format /v1/models endpoint and filter to
 * text-generation models only.
 *
 * @param {string} baseUrl   e.g. "https://api.openai.com"
 * @param {string} apiKey
 * @param {"openai"|"mistral"|"generic"} hint  Controls filtering strictness
 * @returns {Promise<Array<{id: string}>>}
 */
async function _fetchOpenAIStyleModels(baseUrl, apiKey, hint) {
  const resp = await fetch(`${baseUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`API error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  const all = data.data || [];

  let filtered;
  if (hint === "openai") {
    /* OpenAI returns embeddings, audio, image, and legacy models — keep only
       GPT chat and O-series reasoning models. */
    filtered = all.filter((m) => {
      const id = m.id.toLowerCase();
      return (id.startsWith("gpt-") || /^o[0-9]/.test(id)) &&
             !id.includes("realtime") && !id.includes("audio");
    });
  } else if (hint === "mistral") {
    /* Mistral's list is small; only exclude embedding models. */
    filtered = all.filter((m) => !m.id.toLowerCase().includes("embed"));
  } else {
    /* Generic openai-compatible (Ollama, Groq, LM Studio, etc.) — show everything. */
    filtered = all;
  }

  return filtered
    .map((m) => ({ id: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
