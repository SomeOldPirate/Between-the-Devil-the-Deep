/**
 * Between the Devil & the Deep — a SHAMUS/GUMSHOE system for Foundry VTT V14+.
 * @module bdnd
 */

import BDND, { SYSTEM_ID } from "./config.mjs";
import { BDNDActor } from "./actor.mjs";
import { registerSocket } from "./socket.mjs";

import { CharacterData, NpcData } from "./data/actor-creature.mjs";
import ShipData from "./data/actor-ship.mjs";
import CounterBoardData from "./data/actor-counter-board.mjs";
import { itemDataModels } from "./data/items.mjs";

import BDNDCharacterSheet from "./apps/character-sheet.mjs";
import BDNDNpcSheet from "./apps/npc-sheet.mjs";
import BDNDShipSheet from "./apps/ship-sheet.mjs";
import BDNDCounterBoardSheet from "./apps/counter-board-sheet.mjs";
import BDNDItemSheet from "./apps/item-sheet.mjs";

/* -------------------------------------------- */
/*  Coin Flip                                    */
/* -------------------------------------------- */

// Rolls 1dc (Foundry v12+ native coin die). DSN animates it as the custom
// Piece of Eight if the module is active. Result 0 = Tails (wins per SHAMUS).
async function bdndCoinFlip() {
  const roll = new Roll('1dc');
  await roll.evaluate();

  // dc die: result 0 = Tails, result 1 = Heads
  const dieResult = roll.terms[0]?.results?.[0]?.result ?? 0;
  const isTails   = dieResult === 0;

  await ChatMessage.create({
    speaker: { alias: 'The Fates' },
    rolls:   [roll],
    content: `
      <div class="bdnd-spend">
        <h3><i class="fas fa-coins"></i> Piece of Eight — Coin Flip</h3>
        <p class="${isTails ? 'bdnd-result-success' : 'bdnd-result-failure'}"
           style="font-size:1.3em; text-align:center; margin:6px 0;">
          ${isTails ? '✦ TAILS — wins initiative!' : '◯ HEADS'}
        </p>
        <p class="bdnd-rule-note" style="text-align:center;">
          <em>Per SHAMUS rules: Tails always wins.</em>
        </p>
      </div>
    `
  });
}

/* -------------------------------------------- */
/*  Custom Combat class                          */
/* -------------------------------------------- */

// Replaces "Roll Initiative" with a GM reference card showing each combatant's
// Approach Ratings and Pools — the data needed to adjudicate SHAMUS initiative.
// GM then drags combatants into the correct order in the tracker.
class BDNDCombat extends Combat {
  async rollInitiative(ids, options = {}) {
    await this._postInitiativeReference();
    return this;
  }

  async _postInitiativeReference() {
    const rows = this.combatants.contents
      .filter(c => c.actor && c.actor.type !== 'ship')
      .map(c => {
        const actor     = c.actor;
        const approaches = actor.system.approaches ?? {};

        // Top approaches by rating, show rating and current pool
        const approachSummary = Object.entries(approaches)
          .filter(([, d]) => (d.rating ?? 0) > 0)
          .sort(([, a], [, b]) => (b.rating ?? 0) - (a.rating ?? 0))
          .map(([, d]) => `${d.label}: <strong>${d.rating}</strong> (Pool: ${d.value ?? 0})`)
          .join(' &nbsp;·&nbsp; ') || '—';

        // Danger-sense Cherry check
        const hasDangersense = actor.items?.some(
          i => i.type === 'cherry' && i.system.ability === 'sense_trouble'
        );
        const stRating = hasDangersense
          ? (actor.system.abilities?.general?.sense_trouble?.rating ?? 0)
          : null;
        const dsTag = stRating
          ? `<span class="bdnd-bonus" title="May use Sense Trouble for initiative"> ★ ST:${stRating}</span>`
          : '';

        const typeTag = actor.type === 'character'
          ? `<span class="bdnd-bonus">[PC]</span>`
          : `<span class="bdnd-malus">[NPC]</span>`;

        return `<tr>
          <td style="padding:2px 6px;">${typeTag} <strong>${c.name}</strong>${dsTag}</td>
          <td style="padding:2px 6px; font-size:0.9em;">${approachSummary}</td>
        </tr>`;
      }).join('');

    await ChatMessage.create({
      content: `
        <div class="bdnd-spend">
          <h3><i class="fas fa-fist-raised"></i> SHAMUS Initiative Reference</h3>
          <p class="bdnd-rule-note" style="margin-bottom:6px;">
            <strong>Priority:</strong>
            Surprise &rsaquo; Ranged &rsaquo; Long weapon &rsaquo; Medium weapon &rsaquo; Short / Scuffling<br>
            <strong>Tiebreaker:</strong> Approach Rating &rsaquo; Pool &rsaquo;
            Coin Flip <em>(Tails wins — use the 🪙 button in the tracker)</em>
          </p>
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #7A5500;">
                <th style="text-align:left; padding:2px 6px; white-space:nowrap;">Combatant</th>
                <th style="text-align:left; padding:2px 6px;">Approach Ratings</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="2" style="padding:4px;">No combatants.</td></tr>'}</tbody>
          </table>
          <p class="bdnd-rule-note" style="margin-top:6px;">
            <em>Drag combatants in the tracker to set the final order.</em>
          </p>
        </div>
      `
    });
  }
}

/* -------------------------------------------- */
/*  Init                                        */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log("BD&D | Initialising System — Between the Devil and the Deep");

  CONFIG.Actor.documentClass  = BDNDActor;
  CONFIG.Combat.documentClass = BDNDCombat;

  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc: NpcData,
    ship: ShipData,
    counter_board: CounterBoardData
  };
  CONFIG.Item.dataModels = itemDataModels;

  // ── Token resource bars — Health and Stability auto-appear on new tokens ───
  // Tells Foundry which actor attributes are valid resource bars so they show
  // up in the token configuration dropdown and can be assigned to bar1/bar2.
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar:   ["health", "stability"],
      value: []
    },
    npc: {
      bar:   ["health", "stability"],
      value: []
    },
    ship:  { bar: [], value: [] },
    counter_board: { bar: [], value: [] }
  };

  // Initiative is adjudicated by the GM per SHAMUS rules (no automatic roll).
  // "Roll Initiative" posts a reference card; the GM drags combatants to order.
  // Coin flip (Tails wins) is available via the 🪙 button in the tracker.
  CONFIG.Combat.initiative = { formula: "1dc", decimals: 0 };
  CONFIG.BDND = BDND;

  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, BDNDCharacterSheet, {
    types: ["character"], makeDefault: true, label: "Captain Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, BDNDNpcSheet, {
    types: ["npc"], makeDefault: true, label: "NPC Sheet"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, BDNDShipSheet, {
    types: ["ship"], makeDefault: true, label: "Ship Tracker"
  });
  DocumentSheetConfig.registerSheet(Actor, SYSTEM_ID, BDNDCounterBoardSheet, {
    types: ["counter_board"], makeDefault: true, label: "Counter Board"
  });
  DocumentSheetConfig.registerSheet(Item, SYSTEM_ID, BDNDItemSheet, {
    types: Object.keys(itemDataModels), makeDefault: true, label: "Item Sheet"
  });

  // ── Handlebars Helpers ─────────────────────────────────────────────────────

  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('eq',  (a, b) => a === b);

  // Marks an <option> as selected when its value matches the bound field —
  // the old AppV1 `{{#select}}` block helper was removed in V14.
  Handlebars.registerHelper('selected', (a, b) => a === b ? 'selected' : '');

  // Strip HTML for tooltip text
  Handlebars.registerHelper('stripHTML', (html) => {
    if (!html) return "";
    return new DOMParser().parseFromString(html, 'text/html').body.textContent || "";
  });
});

/* -------------------------------------------- */
/*  Dice So Nice — Piece of Eight coin           */
/* -------------------------------------------- */

// Registers a custom dc (coin) die preset so DSN animates the coin flip as a
// Piece of Eight. Face 0 = Tails (wins), Face 1 = Heads.
// Note: if the faces appear swapped in game, swap the two filenames below.
Hooks.once('diceSoNiceReady', (dice3d) => {
  dice3d.addSystem({ id: 'bdnd', name: 'Between the Devil & the Deep' }, 'preferred');

  // ── Default colour scheme ───────────────────────────────────────────────────
  // Pewter/dark-metal look to complement the pirate theme.
  //   foreground (label)  #000000 — black
  //   background (body)   #797b80 — pewter grey
  //   outline             #797b80 — matching
  //   edge                #797b80 — matching
  dice3d.addColorset({
    name:        'bdnd_default',
    description: 'Between the Devil & the Deep',
    category:    'BtDatD',
    foreground:  '#000000',
    background:  '#797b80',
    outline:     '#797b80',
    edge:        '#797b80',
    texture:     'none',
    material:    'metal',
    font:        'Arial',
    system:      'bdnd'
  }, 'preferred');

  // ── Piece of Eight coin — dc die ───────────────────────────────────────────
  // result 0 = Tails (wins per SHAMUS), result 1 = Heads.
  // Note: if the faces appear swapped in game, swap the two filenames below.
  dice3d.addDicePreset({
    type:     'dc',
    labels:   [
      'systems/bdnd/assets/coin-tails.png',
      'systems/bdnd/assets/coin-heads.png'
    ],
    colorset: 'bdnd_default',
    system:   'bdnd'
  });

  // ── Pirate bone d6 ─────────────────────────────────────────────────────────
  // Aged ivory/bone dice with carved pips on faces 1–5.
  // Face 6 shows a skull & crossbones instead of six pips.
  dice3d.addDicePreset({
    type:     'd6',
    labels:   [
      'systems/bdnd/assets/dice/d6-face-1.png',
      'systems/bdnd/assets/dice/d6-face-2.png',
      'systems/bdnd/assets/dice/d6-face-3.png',
      'systems/bdnd/assets/dice/d6-face-4.png',
      'systems/bdnd/assets/dice/d6-face-5.png',
      'systems/bdnd/assets/dice/d6-face-6.png'
    ],
    colorset: 'bdnd_default',
    system:   'bdnd'
  });
});

/* -------------------------------------------- */
/*  Combat Tracker — drag-to-reorder             */
/* -------------------------------------------- */

// SHAMUS uses narrative initiative: the GM decides turn order by dragging
// combatant rows. On drop, initiative values are silently reassigned in
// descending order so Foundry preserves the sequence across re-renders.
// Only the GM can drag; players see the ordered list but cannot change it.
function _enableCombatTrackerDrag(html) {
  if (!game.user?.isGM) return;
  if (!game.combat) return;

  const list = html.querySelector('ol.combat-tracker');
  if (!list) return;

  let dragSrc = null;

  list.querySelectorAll('li.combatant').forEach(li => {
    li.setAttribute('draggable', 'true');

    li.addEventListener('dragstart', e => {
      dragSrc = li;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', li.dataset.combatantId ?? '');
      // Small delay so the browser snapshot doesn't show the faded state
      setTimeout(() => li.classList.add('bdnd-drag-source'), 0);
    });

    li.addEventListener('dragend', () => {
      dragSrc = null;
      list.querySelectorAll('.bdnd-drag-source, .bdnd-drag-over')
          .forEach(el => el.classList.remove('bdnd-drag-source', 'bdnd-drag-over'));
    });

    li.addEventListener('dragover', e => {
      if (!dragSrc || li === dragSrc) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.bdnd-drag-over')
          .forEach(el => el.classList.remove('bdnd-drag-over'));
      li.classList.add('bdnd-drag-over');
    });

    li.addEventListener('dragleave', () => {
      li.classList.remove('bdnd-drag-over');
    });

    li.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === li) return;

      const allItems = Array.from(list.querySelectorAll('li.combatant'));
      const srcIdx = allItems.indexOf(dragSrc);
      const tgtIdx = allItems.indexOf(li);
      if (srcIdx === -1 || tgtIdx === -1) return;

      // Reinsert dragged item at the target position
      allItems.splice(srcIdx, 1);
      allItems.splice(tgtIdx, 0, dragSrc);

      // Reassign descending initiative values to lock in the new order.
      // Multiplying by 10 leaves room for future manual adjustments.
      const total = allItems.length;
      const updates = allItems.map((el, idx) => ({
        _id: el.dataset.combatantId,
        initiative: (total - idx) * 10
      }));

      await game.combat.updateEmbeddedDocuments('Combatant', updates);
    });
  });
}

/* -------------------------------------------- */
/*  Combat Tracker — render hook                 */
/* -------------------------------------------- */

// Injects the 🪙 coin-flip button and enables drag-to-reorder on every render.
// `html` is the tracker's own root HTMLElement (ApplicationV2 render hooks pass
// the native element, not a jQuery-wrapped one).
Hooks.on('renderCombatTracker', (app, html) => {
  // ── Coin flip button ──────────────────────────────────────────────────────
  html.querySelector('.bdnd-coin-flip-btn')?.remove();

  const leftControls = html.querySelector('.encounter-controls .control-buttons.left');
  if (leftControls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inline-control combat-control bdnd-coin-flip-btn';
    btn.dataset.tooltip = 'SHAMUS Tiebreaker — Flip a Piece of Eight (Tails wins)';
    btn.setAttribute('aria-label', 'Coin Flip Tiebreaker');
    btn.style.cssText = 'flex:0 0 auto; font-style:normal;';
    btn.textContent = '🪙';
    btn.addEventListener('click', () => bdndCoinFlip());
    leftControls.append(btn);
  }

  // ── Per-combatant "roll" buttons ──────────────────────────────────────────
  // There's no individual initiative roll in SHAMUS — each one would just
  // repost the whole reference card — so hide them. "Roll All" stays.
  html.querySelectorAll('.combatant-control.roll[data-action="rollInitiative"]').forEach(b => b.remove());

  // ── Drag-to-reorder ───────────────────────────────────────────────────────
  _enableCombatTrackerDrag(html);
});

Hooks.once("ready", () => registerSocket());

/* -------------------------------------------- */
/*  Auto Taken Out → Clutch Test prompt          */
/* -------------------------------------------- */

// When a character's or NPC's Health Risk Counter reaches its maximum, post a
// Taken Out card (with a Clutch Test button for Named NPCs and PCs). Only the
// client that made the change reacts, so the card is posted once and only a
// user who can update the actor touches its flag.
Hooks.on('updateActor', async (actor, changes, _options, userId) => {
  if (userId !== game.user.id) return;
  if (!['character', 'npc'].includes(actor.type)) return;
  const newVal = foundry.utils.getProperty(changes, 'system.health.value');
  if (newVal === undefined) return;

  const max     = actor.system.health?.max ?? actor.system.health?.base ?? 8;
  const flagged = actor.getFlag('bdnd', 'healthMaxAlerted') ?? false;

  // Below max: clear the alert flag (if set) so the next hit-max alerts again
  if (newVal < max) {
    if (flagged) await actor.unsetFlag('bdnd', 'healthMaxAlerted');
    return;
  }
  if (flagged) return;
  await actor.setFlag('bdnd', 'healthMaxAlerted', true);

  const isRegular = (actor.getFlag('bdnd', 'npcType') ?? 'named') === 'regular';
  const outcomeText = isRegular
    ? 'This is a <strong>Regular NPC</strong> — they are immediately <strong>Taken Out</strong>.'
    : 'A <strong>Clutch Test</strong> is required — click below to roll (SHAMUS p.20).';

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="bdnd-roll">
        <h2 style="color:#8b0000;"><i class="fas fa-skull"></i> Taken Out! — ${actor.name}</h2>
        <p>${actor.name}'s Health Risk Counter has reached maximum (${max}).</p>
        <p>${outcomeText}</p>
        ${!isRegular ? `
        <div style="margin-top:6px;">
          <button class="bdnd-clutch-trigger"
                  data-actor-id="${actor.id}"
                  style="width:100%; padding:4px 8px; cursor:pointer;">
            <i class="fas fa-dice"></i> Roll Clutch Test for ${actor.name}
          </button>
        </div>` : ''}
      </div>
    `
  });
});

// Handle the Clutch Test button inside chat — delegate to the actor method
Hooks.on('renderChatMessageHTML', (message, html) => {
  html.querySelector('.bdnd-clutch-trigger')?.addEventListener('click', ev => {
    const actor = game.actors?.get(ev.currentTarget.dataset.actorId);
    if (!actor) return;
    if (!actor.isOwner) return ui.notifications.warn(`Only ${actor.name}'s owner or the GM can roll this Clutch Test.`);
    actor.rollClutchTest();
  });
});
