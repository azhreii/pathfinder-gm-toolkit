/**
 * GM Share / Save Infrastructure — PF2e GM Toolkit
 *
 * Provides GMTOOLKIT.shareContent(), a single routing function that:
 *   1. Whispers the full AI-generated text to the GM only.
 *   2. Offers a "Share with players" button in that whisper that posts a
 *      filtered public message (flavor only — no secrets or motivation).
 *   3. Optionally persists the content to a journal entry or actor biography
 *      at generation time, before the GM decides whether to share.
 *
 * The renderChatMessage hook registered at the bottom of this file wires up
 * the action buttons embedded in whisper messages so they survive across
 * page reloads (hooks are registered globally, not per-ApplicationV2 instance).
 *
 * Load order: after ai-tools.js, before encounter-app.js (see module.json).
 */

/* ------------------------------------------------------------------ */
/* Internal helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Build the shareable (player-safe) subset of an encounter narrative.
 * Omits tactical_notes and battle_map_details — those are GM-only planning aids.
 *
 * @param {object} aiNarrative  encounter.aiNarrative object
 * @returns {string}  HTML fragment safe to post publicly
 */
function _encounterShareableHTML(aiNarrative) {
  const parts = [];
  if (aiNarrative.setting_description) {
    parts.push("<p><strong>Setting:</strong> " + aiNarrative.setting_description + "</p>");
  }
  if (aiNarrative.encounter_hook) {
    parts.push("<p><strong>Hook:</strong> " + aiNarrative.encounter_hook + "</p>");
  }
  return parts.join("\n");
}

/**
 * Build the shareable (player-safe) subset of an NPC profile.
 * Omits motivation and secret — those remain GM-only.
 *
 * @param {object} npc  NPC object with optional AI fields
 * @returns {string}  HTML fragment safe to post publicly
 */
function _npcShareableHTML(npc) {
  const parts = [];
  if (npc.appearance) {
    parts.push("<p><strong>Appearance:</strong> " + npc.appearance + "</p>");
  }
  if (npc.personality) {
    parts.push("<p><strong>Personality:</strong> " + npc.personality + "</p>");
  }
  if (npc.quote) {
    parts.push("<p><em>\"" + npc.quote + "\"</em></p>");
  }
  return parts.join("\n");
}

/**
 * Build the full HTML body for the GM whisper message.
 * Embeds shareable content as a data attribute on the Share button so the
 * renderChatMessage click handler can post it without re-calling the app.
 *
 * @param {string} title          Display title for the card header
 * @param {string} contentType    'encounter' | 'npc' | 'hazard' | 'generic'
 * @param {string} fullText       Complete GM-facing text (plain text or HTML)
 * @param {string} shareableHTML  Player-safe subset for the Share button payload
 * @param {string} shareTitle     Title to use in the public message
 * @returns {string}  Complete HTML string for ChatMessage content
 */
function _buildWhisperHTML(title, contentType, fullText, shareableHTML, shareTitle) {
  /* Escape the shareable HTML for embedding in a data attribute.
     We use encodeURIComponent so angle brackets and quotes survive. */
  const encodedShare = encodeURIComponent(shareableHTML);
  const encodedTitle = encodeURIComponent(shareTitle);

  /* Separator line — pure CSS, no image dependency. */
  const separator = "<hr style=\"border:none;border-top:1px solid var(--color-border-light-primary);margin:0.4rem 0;\">";

  const typeLabel = {
    encounter: "Encounter",
    npc:       "NPC",
    hazard:    "Hazard",
    generic:   "Content",
  }[contentType] || "Content";

  return (
    "<div class=\"gmt-chat-share-msg\">" +
      "<p class=\"gmt-chat-header\"><strong>[GM Toolkit — " + typeLabel + "]</strong></p>" +
      "<p class=\"gmt-chat-title\">" + title + "</p>" +
      separator +
      "<div class=\"gmt-chat-body\">" + fullText + "</div>" +
      separator +
      "<div class=\"gmt-actions gmt-chat-actions\">" +
        "<button type=\"button\" class=\"gmt-share-to-players-btn\"" +
          " data-gmt-action=\"shareToPlayers\"" +
          " data-gmt-content=\"" + encodedShare + "\"" +
          " data-gmt-title=\"" + encodedTitle + "\">" +
          "<i class=\"fas fa-comment-alt\"></i> Share with players" +
        "</button>" +
        "<button type=\"button\" class=\"gmt-save-journal-chat-btn gmt-secondary\"" +
          " data-gmt-action=\"saveToJournalChat\"" +
          " style=\"display:none;\">" +
          "<i class=\"fas fa-book\"></i> Saved" +
        "</button>" +
      "</div>" +
    "</div>"
  );
}

/**
 * Write AI-generated text into the actor's PF2e biography field.
 * Prepends the GM Toolkit block above any existing biography content
 * so we never clobber manual edits the GM already made.
 *
 * @param {Actor}  actor      Foundry Actor document
 * @param {string} newBlock   HTML block to prepend
 * @returns {Promise<void>}
 */
async function _prependActorBio(actor, newBlock) {
  /* PF2e stores the biography in system.details.biography.value (HTML string). */
  const existing = actor.system?.details?.biography?.value || "";
  const combined = newBlock + (existing ? "\n<hr>\n" + existing : "");
  await actor.update({ "system.details.biography.value": combined });
}

/**
 * Format an NPC object as a GM-readable HTML block for whisper + bio.
 * Includes all AI fields (motivation, secret) since this is GM-only content.
 *
 * @param {object} npc
 * @returns {string}
 */
function _npcFullHTML(npc) {
  const parts = [];
  if (npc.appearance)  parts.push("<p><strong>Appearance:</strong> " + npc.appearance + "</p>");
  if (npc.personality) parts.push("<p><strong>Personality:</strong> " + npc.personality + "</p>");
  if (npc.occupation)  parts.push("<p><strong>Occupation:</strong> " + npc.occupation + "</p>");
  if (npc.motivation)  parts.push("<p><strong>Motivation:</strong> " + npc.motivation + "</p>");
  if (npc.secret)      parts.push("<p><strong>Secret:</strong> " + npc.secret + "</p>");
  if (npc.quote)       parts.push("<p><em>\"" + npc.quote + "\"</em></p>");
  return "<p><strong>" + npc.name + "</strong> — " + npc.race + " " + npc.sex + "</p>\n" + parts.join("\n");
}

/* ------------------------------------------------------------------ */
/* Public API: GMTOOLKIT.shareContent                                   */
/* ------------------------------------------------------------------ */

/**
 * Route AI-generated text to the GM (whisper), optionally share to players,
 * and optionally persist to a journal entry or actor biography.
 *
 * @param {object} options
 * @param {string}           options.text        The content to share/save (plain text or HTML)
 * @param {string}           options.title       Display title (journal entry name, chat header)
 * @param {'encounter'|'npc'|'hazard'|'generic'} options.type  Content type
 * @param {'journal'|'actor-bio'|'both'|'none'}  [options.saveTarget='none']
 * @param {Actor}            [options.actor]     Required when saveTarget includes 'actor-bio'
 * @param {object}           [options.encounter] Full encounter result — for rich journal saves
 * @param {Array}            [options.summary]   Encounter summary array — for rich journal saves
 * @param {object}           [options.npc]       Full NPC object — for NPC-type content
 * @returns {Promise<void>}
 */
GMTOOLKIT.shareContent = async function (options) {
  const text       = options.text       || "";
  const title      = options.title      || "GM Toolkit";
  const type       = options.type       || "generic";
  const saveTarget = options.saveTarget || "none";
  const actor      = options.actor      || null;
  const encounter  = options.encounter  || null;
  const summary    = options.summary    || null;
  const npc        = options.npc        || null;

  /* --- Step 3: Persist (runs at generation time, before the whisper) --- */

  if (saveTarget === "journal" || saveTarget === "both") {
    try {
      if (type === "encounter" && encounter && summary) {
        /* Route through the existing rich encounter formatter in storage.js. */
        await GMTOOLKIT.saveEncounterToJournal(encounter, summary);
      } else if (type === "npc" && npc) {
        await GMTOOLKIT.saveNPCToJournal(npc);
      } else {
        /* Generic / hazard — store raw text in a plain journal page. */
        const folder = await _gmShareGetFolder();
        await JournalEntry.create({
          name: title,
          folder: folder.id,
          pages: [
            {
              name: title,
              type: "text",
              text: { content: text, format: 1 },
            },
          ],
        });
      }
    } catch (err) {
      console.error("PF2e GM Toolkit | shareContent: journal save failed:", err);
      ui.notifications.warn("GM Toolkit: Could not save to journal — see console for details.");
    }
  }

  if ((saveTarget === "actor-bio" || saveTarget === "both") && actor) {
    try {
      await _prependActorBio(actor, text);
    } catch (err) {
      console.error("PF2e GM Toolkit | shareContent: actor bio save failed:", err);
      ui.notifications.warn("GM Toolkit: Could not update actor biography — see console for details.");
    }
  }

  /* --- Step 1: Whisper to GM --- */

  /* Build the player-safe subset based on content type. */
  let shareableHTML = "";
  let shareTitle    = title;

  if (type === "encounter" && encounter && encounter.aiNarrative) {
    shareableHTML = _encounterShareableHTML(encounter.aiNarrative);
    shareTitle    = "Encounter: " + (encounter.templateName || title);
  } else if (type === "npc" && npc) {
    shareableHTML = _npcShareableHTML(npc);
    shareTitle    = npc.name || title;
  } else {
    /* Generic — share the same text publicly (GM opted in by calling shareContent). */
    shareableHTML = text;
  }

  const whisperHTML = _buildWhisperHTML(title, type, text, shareableHTML, shareTitle);

  try {
    await ChatMessage.create({
      content: whisperHTML,
      /* Whisper recipients: just populate the whisper array.
         In Foundry v12+ the `type` field for chat messages was removed/renamed;
         setting type:"whisper" causes a validation error in PF2e's ChatMessagePF2e
         subclass. The whisper array alone is sufficient to restrict visibility. */
      whisper: [game.user.id],
      speaker: { alias: "GM Toolkit" },
      flags: { "pf2e-gm-toolkit": { isShareMessage: true } },
    });
  } catch (err) {
    console.error("PF2e GM Toolkit | shareContent: whisper failed:", err);
    ui.notifications.error("GM Toolkit: Could not create whisper message — see console.");
  }
};

/* ------------------------------------------------------------------ */
/* Internal: journal folder helper (mirrors storage.js pattern)         */
/* ------------------------------------------------------------------ */

/**
 * Get or create the GM Toolkit journal folder.
 * Duplicates storage.js _getOrCreateFolder() intentionally — gm-share.js
 * must be self-contained and load before storage.js is guaranteed to run.
 *
 * @returns {Promise<Folder>}
 */
async function _gmShareGetFolder() {
  let folder = game.folders.find(
    function (f) { return f.name === "GM Toolkit" && f.type === "JournalEntry"; }
  );
  if (!folder) {
    folder = await Folder.create({ name: "GM Toolkit", type: "JournalEntry" });
  }
  return folder;
}

/* ------------------------------------------------------------------ */
/* renderChatMessage hook — wires Share and Save buttons               */
/* ------------------------------------------------------------------ */

/**
 * Registered once at module init (not inside any Application class).
 * Handles clicks on the two action buttons embedded in GM whisper messages.
 *
 * Button: [Share with players]
 *   Decodes the shareable HTML from the data attribute and posts a new
 *   public ChatMessage so players can read the flavor content.
 *
 * Button: [Save to journal] (currently hidden; shown via CSS override if needed)
 *   Placeholder wired for future deferred-save UI; currently disabled because
 *   shareContent saves at generation time.
 */
Hooks.on("renderChatMessage", function (message, html, _data) {
  /* Only process messages we created — checked via flag. */
  const isGMTShare = message.getFlag("pf2e-gm-toolkit", "isShareMessage");
  if (!isGMTShare) return;

  /* In Foundry v13 the hook receives an HTMLElement, not a jQuery object.
     Normalise so querySelector always works. */
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el) return;

  /* Wire "Share with players" button. */
  const shareBtn = el.querySelector("[data-gmt-action='shareToPlayers']");
  if (shareBtn) {
    shareBtn.addEventListener("click", async function () {
      /* Decode the pre-built player-safe HTML embedded in the data attribute. */
      const encodedContent = shareBtn.dataset.gmtContent || "";
      const encodedTitle   = shareBtn.dataset.gmtTitle   || "";
      const publicContent  = decodeURIComponent(encodedContent);
      const publicTitle    = decodeURIComponent(encodedTitle);

      if (!publicContent) {
        ui.notifications.warn("GM Toolkit: No shareable content available.");
        return;
      }

      try {
        await ChatMessage.create({
          content: (
            "<div class=\"gmt-chat-share-msg gmt-public-share\">" +
              "<p class=\"gmt-chat-header\"><strong>[GM Toolkit]</strong></p>" +
              "<p class=\"gmt-chat-title\">" + publicTitle + "</p>" +
              "<hr style=\"border:none;border-top:1px solid var(--color-border-light-primary);margin:0.4rem 0;\">" +
              "<div class=\"gmt-chat-body\">" + publicContent + "</div>" +
            "</div>"
          ),
          speaker: { alias: "GM Toolkit" },
          flags: { "pf2e-gm-toolkit": { isPublicShare: true } },
        });

        /* Provide feedback and visually disable the button so the GM doesn't
           accidentally share the same content twice. */
        shareBtn.disabled = true;
        shareBtn.innerHTML = "<i class=\"fas fa-check\"></i> Shared";
        ui.notifications.info("GM Toolkit: Content shared with players.");
      } catch (err) {
        console.error("PF2e GM Toolkit | Share to players failed:", err);
        ui.notifications.error("GM Toolkit: Could not post public message — see console.");
      }
    });
  }

  /* Wire "Save to journal" chat button (hidden by default — available for future use). */
  const saveJournalBtn = el.querySelector("[data-gmt-action='saveToJournalChat']");
  if (saveJournalBtn) {
    saveJournalBtn.addEventListener("click", function () {
      /* This path is reserved for deferred-save scenarios added in a later phase.
         For now persistence happens at generation time inside shareContent(). */
      ui.notifications.info("GM Toolkit: Content was already saved when generated.");
    });
  }
});
