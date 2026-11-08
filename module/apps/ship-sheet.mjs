/**
 * The ship tracker sheet.
 * @module bdnd/apps/ship-sheet
 */

import { SYSTEM_ID } from "../config.mjs";
import { updateActorAnywhere } from "../socket.mjs";

const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { FormDataExtended } = foundry.applications.ux;

/**
 * @extends {ActorSheetV2}
 */
export default class BDNDShipSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bdnd-ship-{id}",
    classes: ["bdnd", "sheet", "ship"],
    position: { width: 700, height: 760 },
    window: { resizable: true, icon: "fa-solid fa-ship" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      counterInc: BDNDShipSheet.#onCounterIncrease,
      counterDec: BDNDShipSheet.#onCounterDecrease,
      counterRiskRoll: BDNDShipSheet.#onRiskCounterRoll,
      payout: BDNDShipSheet.#onPayout,
      fireCannons: BDNDShipSheet.#onFireCannons
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/actor/ship-sheet.hbs`, root: true, scrollable: [""] }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;
    context.actor = actor;
    context.system = system;
    context.editable = this.isEditable;
    context.fields = system.schema.fields;

    context.labels = {
      boarding: this.constructor.getBoardingLabel(system.counters.boarding.value),
      shape:    this.constructor.getShapeLabel(system.counters.ship_shape.value),
      maneuver: this.constructor.getManeuverLabel(system.counters.maneuver.value)
    };
    const pct = (v, m) => Math.min(100, Math.max(0, Math.round((v / (m || 1)) * 100)));
    context.pct = {
      maneuver: pct(system.counters.maneuver.value,   system.counters.maneuver.max),
      shape:    pct(system.counters.ship_shape.value, system.counters.ship_shape.max),
      boarding: pct(system.counters.boarding.value,   system.counters.boarding.max)
    };
    return context;
  }

  /* --- STATUS LABEL HELPERS (SHAMUS rules text) --- */

  static getManeuverLabel(val) {
    if (val >= 36) return "Into the Deep Blue — escape if Sails > Min; otherwise reset to [10] vs opponent [4].";
    if (val >= 30) return "Leeward Boarding — may start boarding.";
    if (val >= 24) return "(TN4) Under/Outer Position — fire Broadsides without retaliation until opponent matches.";
    if (val >= 20) return "Weather Gauge — may flee the battle or prevent opponent's escape.";
    if (val >= 16) return "(TN4) Advantage — +1 on cannon attack Tests for rest of battle.";
    if (val >= 14) return "(TN3) Boarding Start — may initiate boarding.";
    if (val >= 12) return "Weather Gauge — may flee or prevent opponent's escape.";
    if (val >= 10) return "(TN6) Broadside Start — first here has initiative.";
    if (val >= 6)  return "Examination & Parley — may Sense Trouble; may shout over the rail.";
    if (val >= 4)  return "Sighting — identify flag and masts.";
    return "Base — Sails on the horizon.";
  }

  static getBoardingLabel(val) {
    if (val >= 20) return "Takeover.";
    if (val >= 16) return "Sweep Up — situation dire, no Broadside Actions. −2d6 Hands.";
    if (val >= 12) return "Exploitation — enemy gains Flanking Advantage. −d6 Hands.";
    if (val >= 8)  return "CQ Battle — fighting in rigging and stairways; officers at defended positions vulnerable. −d3 Hands.";
    if (val >= 4)  return "Boarding — Maneuver Counters stop; fighting on top deck. −d3 Hands.";
    return "Base — ships at Point Blank range.";
  }

  static getShapeLabel(val) {
    if (val >= 40) return "⚠ ABANDON SHIP!";
    if (val >= 34) return "Immobilised — no Movement Counter Rolls until repaired.";
    if (val >= 30) return "Casualties — −1d6 Hands and (−d6 Sails or −2 Cannons).";
    if (val >= 26) return "Taking Water — repair (TN6) or +1 counter/round (cumulative).";
    if (val >= 22) return "Casualties — −1d6 Hands and (−d6 Sails or −2 Cannons).";
    if (val >= 18) return "Upper Deck Damaged — enemy chooses: −d6 Hands, −2 Sails, or −2 Cannons.";
    if (val >= 14) return "Taking Water — repair (TN5) or +1 counter/round. −d3 Hands.";
    if (val >= 12) return "Raked — enemy chooses: −d3 Hands, −1 Sails or −1 Cannons.";
    if (val >= 8)  return "Taking Hits — enemy chooses: −d3 Hands, −1 Sails or −1 Cannons.";
    if (val >= 4)  return "Incoming! — enemy chooses: −d3 Hands or −1 Sails.";
    return "Base.";
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onCounterIncrease(event, target) {
    if (!this.isEditable) return;
    const path = target.dataset.target;
    const current = foundry.utils.getProperty(this.actor, path) ?? 0;
    const maxPath = path.replace(".value", ".max");
    const max = foundry.utils.getProperty(this.actor, maxPath) ?? 999;
    await this.actor.update({ [path]: Math.min(max, current + 1) });
  }

  static async #onCounterDecrease(event, target) {
    if (!this.isEditable) return;
    const path = target.dataset.target;
    const current = foundry.utils.getProperty(this.actor, path) ?? 0;
    await this.actor.update({ [path]: Math.max(0, current - 1) });
  }

  /**
   * Risk/Progress Counter advance by 1d6 + ship modifier, per BD&D rules:
   * - Maneuver: 1d6 + Sails rating (Navigation test success)
   * - Ship Shape: 1d6 + opponent's Cannons current (broadside hit) — opponent
   *   modifier entered via dialog since we can't auto-read the enemy sheet
   * - Boarding: 1d6 (no ship modifier)
   */
  static async #onRiskCounterRoll(event, target) {
    if (!this.isEditable) return;
    const path  = target.dataset.target;
    const label = target.dataset.label ?? "Counter";

    // Determine the ship's own modifier for this counter type
    const isManeuver  = path.includes("maneuver");
    const isShipShape = path.includes("ship_shape");

    let autoMod = 0;
    let modLabel = "";
    let modDialog = false;

    if (isManeuver) {
      autoMod  = this.actor.system.sails?.current ?? this.actor.system.sails?.rating ?? 0;
      modLabel = `Sails (${autoMod >= 0 ? "+" : ""}${autoMod})`;
    } else if (isShipShape) {
      // Ship Shape advances from the *opponent's* Cannons — must ask
      modDialog = true;
    }

    // For Ship Shape, ask for the opponent's Cannons modifier
    let finalMod = autoMod;
    if (modDialog) {
      const dialogMod = await DialogV2.prompt({
        window: { title: `${label} Counter Advance` },
        classes: ["bdnd-dialog"],
        position: { width: 380 },
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">Enter the <strong>opponent's current Cannons</strong> value
            — this is added to the 1d6 roll per SHAMUS rules.</p>
            <div class="form-group">
              <label>Opponent's Cannons:</label>
              <input type="number" name="mod" value="0" min="-10" max="20" autofocus/>
            </div>
          </form>
        `,
        ok: {
          label: "Roll",
          icon: "fas fa-dice",
          callback: (ev, button) => parseInt(new FormDataExtended(button.form).object.mod) || 0
        },
        rejectClose: false
      });
      if (dialogMod === null) return;
      finalMod = dialogMod;
      modLabel = `Opponent Cannons (${finalMod >= 0 ? "+" : ""}${finalMod})`;
    }

    // This ship's Armor is subtracted from Ship Shape rolls against it
    const armor = isShipShape ? Math.max(0, this.actor.system.armor ?? 0) : 0;

    const formula = ["1d6", finalMod !== 0 ? "@mod" : null, armor ? "@armor" : null]
      .filter(Boolean).join(" + ").replace("+ @armor", "- @armor");
    const roll = new Roll(formula, { mod: finalMod, armor });
    await roll.evaluate();
    const advance = Math.max(0, roll.total);

    const current  = foundry.utils.getProperty(this.actor, path) ?? 0;
    const maxPath  = path.replace(".value", ".max");
    const max      = foundry.utils.getProperty(this.actor, maxPath) ?? 999;
    const newValue = Math.min(max, current + advance);

    await this.actor.update({ [path]: newValue });

    let breakdownHTML = `<div class="bdnd-breakdown-row"><span>Dice Roll:</span><strong>${advance}</strong></div>`;
    if (modLabel) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>${modLabel}:</span><strong>included above</strong></div>`;
    if (armor) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Armor (−${armor}):</span><strong>included above</strong></div>`;
    breakdownHTML += `<div class="bdnd-breakdown-row"><span>Counter:</span><strong>${current} → ${newValue} / ${max}</strong></div>`;

    // List any thresholds crossed so GM knows which effects to apply
    const thresholds = isManeuver
      ? [4, 6, 10, 12, 14, 16, 20, 24, 30, 36]
      : isShipShape
        ? [4, 8, 12, 14, 18, 22, 26, 30, 34, 40]
        : [4, 8, 12, 16, 20]; // boarding
    const crossed = thresholds.filter(t => t > current && t <= newValue);
    if (crossed.length) {
      breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Thresholds crossed:</span><strong>${crossed.join(", ")}</strong></div>`;
      for (const t of crossed) {
        const lbl = isManeuver ? this.constructor.getManeuverLabel(t)
                  : isShipShape ? this.constructor.getShapeLabel(t)
                  : this.constructor.getBoardingLabel(t);
        breakdownHTML += `<div class="bdnd-threshold-note"><span class="threshold-level">${t}:</span> ${lbl}</div>`;
      }
    }

    if (newValue >= max) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>⚠ COUNTER MAXED</span></div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="bdnd-roll">
          <h2>${label} Counter Advance</h2>
          <div class="roll-details">${breakdownHTML}</div>
        </div>
      `,
      rolls: [roll]
    });
  }

  /**
   * Fire Broadsides — an Artillery test (SHAMUS p.58–62). The gunner is
   * picked from the crew this user controls (defaulting to the actor named in
   * the Captain field); their own Artillery test dialog then takes over.
   * With no gunner, a plain 2d6 + modifier roll is made instead.
   */
  static async #onFireCannons() {
    if (!this.isEditable) return;
    const cannons = this.actor.system.cannons.current ?? 0;
    if (cannons <= 0) return ui.notifications.warn("This ship has no cannons!");
    const cannonText = `${cannons} cannon${cannons !== 1 ? "s" : ""}`;

    const crew = game.actors
      .filter(a => ["character", "npc"].includes(a.type) && a.isOwner)
      .sort((a, b) => (b.system.abilities.general.artillery.rating - a.system.abilities.general.artillery.rating) || a.name.localeCompare(b.name));
    const captainName = this.actor.system.captain?.trim();
    const defaultId = crew.find(a => a.name === captainName)?.id ?? crew[0]?.id ?? "";
    const gunnerOptions = crew.map(a => {
      const art = a.system.abilities.general.artillery;
      return `<option value="${a.id}" ${a.id === defaultId ? "selected" : ""}>${a.name} (Artillery Rtg ${art.rating}, Pool ${art.value})</option>`;
    }).join("");

    const choice = await DialogV2.prompt({
      window: { title: `Fire Broadsides (${cannonText})` },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
      content: `
        <div class="bdnd-dialog">
          <div class="form-group">
            <label>Gunner:</label>
            <select name="gunner" style="width:100%;">
              ${gunnerOptions}
              <option value="">No gunner — plain roll</option>
            </select>
          </div>
          <p class="bdnd-rule-note">The gunner makes an Artillery test. With no gunner,
            enter TN and modifier below for a plain 2d6 roll.</p>
          <div class="form-group"><label>TN (plain roll only):</label>
            <input type="number" name="tn" value="8" min="2" max="15"/></div>
          <div class="form-group"><label>Modifier (plain roll only):</label>
            <input type="number" name="mod" value="0" min="-5" max="20"/></div>
        </div>
      `,
      ok: {
        label: "Fire!",
        icon: "fas fa-fire",
        callback: (ev, button) => {
          const fd = new FormDataExtended(button.form).object;
          return { gunner: fd.gunner || null, tn: parseInt(fd.tn) || 8, mod: parseInt(fd.mod) || 0 };
        }
      },
      rejectClose: false
    });
    if (!choice) return;

    const gunner = choice.gunner ? game.actors.get(choice.gunner) : null;
    if (gunner) return gunner.rollGeneralAbility("artillery", { title: `Broadside (${cannonText})` });

    const roll = new Roll("2d6 + @mod", { mod: choice.mod });
    await roll.evaluate();
    const isSuccess = roll.total >= choice.tn;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="bdnd-roll bdnd-broadside">
          <h2><i class="fas fa-fire"></i> Broadside! (${cannonText})</h2>
          <div class="roll-details">
            <div class="bdnd-breakdown-row"><span>Modifier:</span><strong>${choice.mod >= 0 ? "+" : ""}${choice.mod}</strong></div>
          </div>
          <div class="dice-result">
            <h3>Result: ${roll.total}</h3>
            <div class="tn-label">(TN: ${choice.tn})</div>
            ${isSuccess ? `<span class="bdnd-result-success">HIT — Apply Damage</span>` : `<span class="bdnd-result-failure">MISS</span>`}
          </div>
        </div>
      `,
      rolls: [roll]
    });
  }

  /**
   * Divide Plunder.
   * Deducts sailor points (crew cost), splits remainder equally among PCs.
   */
  static async #onPayout() {
    if (!this.isEditable) return;
    const booty   = this.actor.system.booty.value ?? 0;
    const hands   = this.actor.system.hands?.current ?? 0;
    const players = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);

    if (players.length === 0) {
      ui.notifications.warn("No player characters found to distribute plunder to.");
      return;
    }

    // GM enters crew cut — hands.current pre-filled as a reference
    const crewCut = await DialogV2.prompt({
      window: { title: "Divide the Plunder" },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
      content: `
        <form class="bdnd-dialog">
          <p class="bdnd-rule-note">
            <strong>Total Booty:</strong> ${booty}<br>
            <strong>Current Hands:</strong> ${hands} (for reference)
          </p>
          <div class="form-group">
            <label>Crew's Cut (deducted before PC split):</label>
            <input type="number" name="cut" value="${hands}" min="0" max="${booty}" autofocus/>
          </div>
        </form>
      `,
      ok: {
        label: "Calculate Split",
        icon: "fas fa-coins",
        callback: (ev, button) => parseInt(new FormDataExtended(button.form).object.cut) || 0
      },
      buttons: [{ action: "cancel", label: "Cancel", callback: () => null }],
      rejectClose: false
    });

    if (crewCut === null) return;

    if (booty < crewCut) {
      ui.notifications.warn("Not enough Booty to cover the crew's cut!");
      return;
    }

    const remainder = booty - crewCut;
    const share     = Math.floor(remainder / players.length);
    const leftOver  = remainder % players.length;

    const confirmed = await DialogV2.confirm({
      window: { title: "Confirm Payout" },
      content: `
        <div class="bdnd-dialog">
          <p><strong>Booty:</strong> ${booty}</p>
          <p><strong>Crew Cut:</strong> −${crewCut}</p>
          <hr>
          <p><strong>Each PC receives:</strong> ${share} coin (${players.length} PCs)</p>
          <p><em>Leftover in hold: ${leftOver}</em></p>
        </div>
      `,
      rejectClose: false
    });

    if (!confirmed) return;

    // Players can't update other players' captains directly — relay via the GM
    for (const pc of players) {
      await updateActorAnywhere(pc, { "system.coin.value": (pc.system.coin.value ?? 0) + share });
    }
    await this.actor.update({ "system.booty.value": leftOver });
    ui.notifications.info(`Plunder divided — ${share} coin given to each of ${players.length} PCs.`);
  }
}
