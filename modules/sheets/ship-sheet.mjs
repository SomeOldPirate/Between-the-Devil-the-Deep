export class BDNDShipSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/bdnd/templates/actor/ship-sheet.hbs",
      classes: ["bdnd", "sheet", "ship"],
      width: 700,
      height: 760,
      tabs: []
    });
  }

  getData() {
    const context = super.getData();
    context.system = this.actor.system;
    context.labels = {
      boarding: this._getBoardingLabel(context.system.counters.boarding.value),
      shape:    this._getShapeLabel(context.system.counters.ship_shape.value),
      maneuver: this._getManeuverLabel(context.system.counters.maneuver.value)
    };
    const pct = (v, m) => Math.min(100, Math.max(0, Math.round((v / (m || 1)) * 100)));
    context.pct = {
      maneuver: pct(context.system.counters.maneuver.value,   context.system.counters.maneuver.max),
      shape:    pct(context.system.counters.ship_shape.value, context.system.counters.ship_shape.max),
      boarding: pct(context.system.counters.boarding.value,   context.system.counters.boarding.max)
    };
    return context;
  }

  /* --- STATUS LABEL HELPERS (SHAMUS rules text) --- */

  _getManeuverLabel(val) {
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

  _getBoardingLabel(val) {
    if (val >= 20) return "Takeover.";
    if (val >= 16) return "Sweep Up — situation dire, no Broadside Actions. −2d6 Hands.";
    if (val >= 12) return "Exploitation — enemy gains Flanking Advantage. −d6 Hands.";
    if (val >= 8)  return "CQ Battle — fighting in rigging and stairways; officers at defended positions vulnerable. −d3 Hands.";
    if (val >= 4)  return "Boarding — Maneuver Counters stop; fighting on top deck. −d3 Hands.";
    return "Base — ships at Point Blank range.";
  }

  _getShapeLabel(val) {
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

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find('.counter-inc').click(this._onCounterIncrease.bind(this));
    html.find('.counter-dec').click(this._onCounterDecrease.bind(this));
    html.find('.counter-risk-roll').click(this._onRiskCounterRoll.bind(this));
    html.find('.payout-btn').click(this._onPayout.bind(this));
    html.find('.fire-cannons').click(this._onFireCannons.bind(this));
  }

  async _onCounterIncrease(event) {
    event.preventDefault();
    const target = event.currentTarget.dataset.target;
    const current = foundry.utils.getProperty(this.actor, target) ?? 0;
    const maxPath = target.replace('.value', '.max');
    const max = foundry.utils.getProperty(this.actor, maxPath) ?? 999;
    await this.actor.update({ [target]: Math.min(max, current + 1) });
  }

  async _onCounterDecrease(event) {
    event.preventDefault();
    const target = event.currentTarget.dataset.target;
    const current = foundry.utils.getProperty(this.actor, target) ?? 0;
    await this.actor.update({ [target]: Math.max(0, current - 1) });
  }

  /**
   * Risk/Progress Counter advance by 1d6 + ship modifier, per BD&D rules:
   * - Maneuver: 1d6 + Sails rating (Navigation test success)
   * - Ship Shape: 1d6 + opponent's Cannons current (broadside hit) — opponent
   *   modifier entered via dialog since we can't auto-read the enemy sheet
   * - Boarding: 1d6 (no ship modifier)
   */
  async _onRiskCounterRoll(event) {
    event.preventDefault();
    const target = event.currentTarget.dataset.target;
    const label  = event.currentTarget.dataset.label ?? "Counter";

    // Determine the ship's own modifier for this counter type
    const isManeuver  = target.includes('maneuver');
    const isShipShape = target.includes('ship_shape');

    let autoMod = 0;
    let modLabel = '';
    let modDialog = false;

    if (isManeuver) {
      autoMod  = this.actor.system.sails?.current ?? this.actor.system.sails?.rating ?? 0;
      modLabel = `Sails (${autoMod >= 0 ? '+' : ''}${autoMod})`;
    } else if (isShipShape) {
      // Ship Shape advances from the *opponent's* Cannons — must ask
      modDialog = true;
    }

    // For Ship Shape, ask for the opponent's Cannons modifier
    let finalMod = autoMod;
    if (modDialog) {
      const dialogMod = await new Promise((resolve) => {
        new Dialog({
          title: `${label} Counter Advance`,
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
          buttons: {
            roll: {
              label: "Roll",
              icon: "<i class='fas fa-dice'></i>",
              callback: (html) => resolve(parseInt(html.find('[name="mod"]').val()) || 0)
            }
          },
          default: "roll",
          close: () => resolve(null)
        }).render(true);
      });
      if (dialogMod === null) return;
      finalMod = dialogMod;
      modLabel = `Opponent Cannons (${finalMod >= 0 ? '+' : ''}${finalMod})`;
    }

    const formula = finalMod !== 0 ? `1d6 + @mod` : `1d6`;
    const roll = new Roll(formula, { mod: finalMod });
    await roll.evaluate();

    const current  = foundry.utils.getProperty(this.actor, target) ?? 0;
    const maxPath  = target.replace('.value', '.max');
    const max      = foundry.utils.getProperty(this.actor, maxPath) ?? 999;
    const newValue = Math.min(max, current + roll.total);

    await this.actor.update({ [target]: newValue });

    let breakdownHTML = `<div class="bdnd-breakdown-row"><span>Dice Roll:</span><strong>${roll.total}</strong></div>`;
    if (modLabel) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>${modLabel}:</span><strong>included above</strong></div>`;
    breakdownHTML += `<div class="bdnd-breakdown-row"><span>Counter:</span><strong>${current} → ${newValue} / ${max}</strong></div>`;

    // List any thresholds crossed so GM knows which effects to apply
    const thresholds = isManeuver
      ? [4, 6, 10, 12, 14, 16, 20, 24, 30, 36]
      : isShipShape
        ? [4, 8, 12, 14, 18, 22, 26, 30, 34, 40]
        : [4, 8, 12, 16, 20]; // boarding
    const crossed = thresholds.filter(t => t > current && t <= newValue);
    if (crossed.length) {
      breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Thresholds crossed:</span><strong>${crossed.join(', ')}</strong></div>`;
      for (const t of crossed) {
        const lbl = isManeuver ? this._getManeuverLabel(t)
                  : isShipShape ? this._getShapeLabel(t)
                  : this._getBoardingLabel(t);
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
      type: ChatMessage.TYPES.ROLL,
      rolls: [roll]
    });
  }

  /**
   * Fire Broadsides — Artillery ability test per SHAMUS rules (p.58–62).
   * The number of cannons may influence the GM's damage ruling but the
   * resolution is a single 1d6 + Approach + Spend roll.
   */
  async _onFireCannons(event) {
    event.preventDefault();
    const cannons = this.actor.system.cannons.current ?? 0;
    if (cannons <= 0) return ui.notifications.warn("This ship has no cannons!");

    // We need a reference to the captain's actor to roll their Artillery ability.
    // If no linked actor found, fall back to a plain 1d6 roll with a note.
    const captainName = this.actor.system.captain;
    const captainActor = game.actors.find(a => a.name === captainName && a.type === "character");

    if (captainActor && captainActor.system.abilities?.general?.artillery) {
      // Delegate to the captain's rollGeneralAbility for a proper SHAMUS test
      ui.notifications.info(`Rolling Artillery for ${captainActor.name}…`);
      return captainActor.rollGeneralAbility("artillery", {
        title: `Broadside (${cannons} cannon${cannons !== 1 ? 's' : ''})`
      });
    }

    // Fallback: plain dialog with no ability tracking
    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: "Fire Broadsides",
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">Artillery test: 1d6 + Approach + Spend vs GM-set TN.<br>
            <em>Tip: link a Captain actor to enable full ability tracking.</em></p>
            <div class="form-group">
              <label>Target Number (TN):</label>
              <input type="number" name="tn" value="5" min="2" max="10" autofocus/>
            </div>
            <div class="form-group">
              <label>Modifier (Approach + Spend combined):</label>
              <input type="number" name="mod" value="0" min="-5" max="20"/>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: `Fire! (${cannons} cannon${cannons !== 1 ? 's' : ''})`,
            icon: "<i class='fas fa-fire'></i>",
            callback: (html) => resolve({
              tn: parseInt(html.find('[name="tn"]').val()) || 5,
              mod: parseInt(html.find('[name="mod"]').val()) || 0
            })
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const roll = new Roll("1d6 + @mod", { mod: dialogResult.mod });
    await roll.evaluate();

    const isSuccess = roll.total >= dialogResult.tn;
    const resultSpan = isSuccess
      ? `<span class="bdnd-result-success">HIT — Apply Damage</span>`
      : `<span class="bdnd-result-failure">MISS</span>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="bdnd-roll bdnd-broadside">
          <h2><i class="fas fa-fire"></i> Broadside! (${cannons} cannon${cannons !== 1 ? 's' : ''})</h2>
          <div class="roll-details">
            <div class="bdnd-breakdown-row"><span>Modifier:</span><strong>${dialogResult.mod >= 0 ? '+' : ''}${dialogResult.mod}</strong></div>
          </div>
          <div class="dice-result">
            <h3>Result: ${roll.total}</h3>
            <div class="tn-label">(TN: ${dialogResult.tn})</div>
            ${resultSpan}
          </div>
        </div>
      `,
      type: ChatMessage.TYPES.ROLL,
      rolls: [roll]
    });
  }

  /**
   * Divide Plunder.
   * Deducts sailor points (crew cost), splits remainder equally among PCs.
   */
  async _onPayout(event) {
    event.preventDefault();
    const booty   = this.actor.system.booty.value ?? 0;
    const hands   = this.actor.system.hands?.current ?? 0;
    const players = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);

    if (players.length === 0) {
      ui.notifications.warn("No player characters found to distribute plunder to.");
      return;
    }

    // GM enters crew cut — hands.current pre-filled as a reference
    const crewCut = await new Promise((resolve) => {
      new Dialog({
        title: "Divide the Plunder",
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
        buttons: {
          pay: {
            label: "Calculate Split",
            icon: '<i class="fas fa-coins"></i>',
            callback: (html) => resolve(parseInt(html.find('[name="cut"]').val()) || 0)
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "pay",
        close: () => resolve(null)
      }).render(true);
    });

    if (crewCut === null) return;

    if (booty < crewCut) {
      ui.notifications.warn("Not enough Booty to cover the crew's cut!");
      return;
    }

    const remainder = booty - crewCut;
    const share     = Math.floor(remainder / players.length);
    const leftOver  = remainder % players.length;

    const confirmed = await Dialog.confirm({
      title: "Confirm Payout",
      content: `
        <div class="bdnd-dialog">
          <p><strong>Booty:</strong> ${booty}</p>
          <p><strong>Crew Cut:</strong> −${crewCut}</p>
          <hr>
          <p><strong>Each PC receives:</strong> ${share} coin (${players.length} PCs)</p>
          <p><em>Leftover in hold: ${leftOver}</em></p>
        </div>
      `
    });

    if (!confirmed) return;

    for (const pc of players) {
      await pc.update({ "system.coin.value": (pc.system.coin.value ?? 0) + share });
    }
    await this.actor.update({ "system.booty.value": leftOver });
    ui.notifications.info(`Plunder divided — ${share} coin given to each of ${players.length} PCs.`);
  }
}
