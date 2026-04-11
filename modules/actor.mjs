import { BDNDActorSheet } from "./sheets/actor-sheet.mjs";

export class BDNDActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() { }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    if (actorData.type === 'character') this._prepareCharacterData(actorData);
  }

  _prepareCharacterData(actorData) {
    // Derive Health and Stability Risk Counter maxes from base + Cherry bonuses.
    // base is the GM-editable ceiling (stored in template, never overwritten here).
    // max is always re-derived each render so it never compounds across updates.
    const sys = actorData.system;
    const cherries = actorData.items?.filter(i => i.type === 'cherry') ?? [];

    const healthBonus    = cherries.reduce((sum, c) => sum + (Number(c.system.health_max_bonus)    || 0), 0);
    const stabilityBonus = cherries.reduce((sum, c) => sum + (Number(c.system.stability_max_bonus) || 0), 0);

    if (sys.health)    sys.health.max    = (sys.health.base    ?? 8) + healthBonus;
    if (sys.stability) sys.stability.max = (sys.stability.base ?? 8) + stabilityBonus;
  }

  /* -------------------------------------------- */
  /*  Shared Helpers                               */
  /* -------------------------------------------- */

  /** Format an ability key into a human-readable label. */
  static formatKey(key) {
    return key.replaceAll('_', ' ').split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /** Build an HTML string of approach <option> elements. */
  _buildApproachOptions(showPool = false) {
    const approaches = this.system.approaches;
    if (!approaches) return '';
    return Object.entries(approaches).map(([key, data]) => {
      const label = data.label || BDNDActor.formatKey(key);
      const extra = showPool ? ` (Pool: ${data.value ?? 0})` : ` (+${data.rating ?? 0})`;
      return `<option value="${key}">${label}${extra}</option>`;
    }).join('');
  }

  /** Post a roll result to chat, with automatic Greater Success and Complication detection. */
  async _postRollMessage({ title, roll, tn, breakdownHTML, successLabel, failLabel, colorAccent = '', isCombat = false, isRanged = false }) {
    const isSuccess       = roll.total >= tn;
    const isGreaterSuccess = isSuccess && (roll.total >= tn + 3);

    // Complication: any active die in the pool shows a natural 1 (p.19)
    const dieResults      = roll.terms[0]?.results ?? [];
    const hasComplication = dieResults.some(r => r.result === 1 && r.active !== false);

    const resultSpan = isGreaterSuccess
      ? `<span class="bdnd-result-greater-success">⭐ GREATER SUCCESS!</span>`
      : isSuccess
        ? `<span class="bdnd-result-success">${successLabel ?? 'SUCCESS'}</span>`
        : `<span class="bdnd-result-failure">${failLabel ?? 'FAILURE'}</span>`;

    // Greater Success options block
    let greaterSuccessHTML = '';
    if (isGreaterSuccess && isCombat) {
      greaterSuccessHTML = `
        <div class="bdnd-greater-success">
          <strong>Greater Success — choose one additional effect:</strong>
          <ul>
            <li>Reduce a chosen enemy Ability Pool by <strong>2 points</strong></li>
            <li>Force the target to take a <strong>Condition</strong></li>
            <li>Add <strong>+3 damage</strong> to this hit</li>
          </ul>
        </div>`;
    } else if (isGreaterSuccess) {
      greaterSuccessHTML = `<div class="bdnd-greater-success">Greater Success — an especially advantageous outcome occurs.</div>`;
    }

    // Complication block
    let complicationHTML = '';
    if (hasComplication) {
      let combatNote = '';
      if (isCombat) {
        combatNote = isRanged
          ? ' Ranged: wrong target is hit, or weapon misfires, jams, breaks, or runs out of ammo.'
          : ' Melee: weapon is damaged, broken, or dropped.';
      }
      complicationHTML = `<div class="bdnd-complication">⚠ Complication (natural 1 rolled) — something goes wrong even on a success.${combatNote}</div>`;
    }

    const accentStyle = colorAccent ? `border-color: ${colorAccent};` : '';
    const titleStyle  = colorAccent ? `color: ${colorAccent};` : '';

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-roll" style="${accentStyle}">
          <h2 style="${titleStyle}">${title}</h2>
          <div class="roll-details">${breakdownHTML}</div>
          <div class="dice-result">
            <h3>Result: ${roll.total}</h3>
            <div class="tn-label">(Target Number: ${tn})</div>
            ${resultSpan}
          </div>
          ${greaterSuccessHTML}
          ${complicationHTML}
        </div>
      `,
      type: ChatMessage.TYPES.ROLL,
      rolls: [roll]
    });
  }

  /* -------------------------------------------- */
  /*  General Ability Test                         */
  /* -------------------------------------------- */

  async rollGeneralAbility(abilityKey, options = {}) {
    const ability = this.system.abilities.general[abilityKey];
    if (!ability) return ui.notifications.error(`Ability "${abilityKey}" not found.`);

    const isContest = options.isContest ?? false;
    const currentPool = ability.value ?? 0;
    const rollTitle = options.title || BDNDActor.formatKey(abilityKey).toUpperCase();
    const unskilledPenalty = ability.rating === 0 ? -2 : 0;

    // Check for a Cherry on this ability
    const cherry = this.items.find(i => i.type === 'cherry' && i.system.ability === abilityKey);
    const cherryName = cherry?.name ?? null;
    const hasPostRollSpend = cherry?.system.has_post_roll_spend ?? false;

    // Contest mode: no TN field
    const tnField = isContest
      ? `<p class="bdnd-rule-note">
           <strong>Contest:</strong> Both sides roll independently.
           The GM compares results — higher wins. Ask your opponent to also roll their side.
         </p>`
      : `<div class="form-group">
           <label>Target Number (TN):</label>
           <input type="number" name="tn" value="8" min="2" max="13"/>
         </div>`;

    // Cherry reminder shown in dialog
    const cherryBlock = cherryName ? `
      <div class="bdnd-cherry-notice">
        <i class="fas fa-star"></i> Cherry: <strong>${cherryName}</strong>
        ${hasPostRollSpend ? '— Post-roll spend available (spend 2 after result for +1)' : ''}
      </div>` : '';

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: isContest ? `Contest: ${rollTitle}` : `Test: ${rollTitle}`,
        content: `
          <form class="bdnd-dialog">
            <div class="form-group">
              <label>Ability: <strong>${rollTitle}</strong>
                &nbsp;Rating: <strong>${ability.rating}</strong>
                &nbsp;Pool: <strong>${currentPool}</strong>
                ${unskilledPenalty !== 0 ? '<span class="bdnd-unskilled">(Unskilled −2)</span>' : ''}
              </label>
            </div>
            ${cherryBlock}
            ${tnField}
            <div class="form-group">
              <label>Select Approach (adds its Rating free):</label>
              <select name="approachKey" style="width:100%;">
                ${this._buildApproachOptions()}
              </select>
            </div>
            <div class="form-group">
              <label>Spend Ability Pool Points (Max: ${currentPool}):</label>
              <input type="number" name="spend" value="0" min="0" max="${currentPool}" autofocus/>
            </div>
            <div class="form-group bdnd-exploit-group">
              <label>
                <input type="checkbox" name="exploit"/>
                GM Granted Exploit Point? (+2, requires pool spend)
              </label>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: isContest ? "Roll My Side" : "Roll Die",
            icon: isContest ? "<i class='fas fa-swords'></i>" : "<i class='fas fa-dice'></i>",
            callback: (html) => resolve({
              tn: parseInt(html.find('[name="tn"]').val()) || 5,
              approachKey: html.find('[name="approachKey"]').val(),
              spend: parseInt(html.find('[name="spend"]').val()) || 0,
              exploit: html.find('[name="exploit"]').is(':checked')
            })
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const selectedApproach = this.system.approaches[dialogResult.approachKey];
    const approachMod = selectedApproach?.rating ?? 0;
    const approachLabel = selectedApproach?.label ?? dialogResult.approachKey;

    const activeConditions = this.items.filter(
      i => i.type === "condition" && i.system.approach === dialogResult.approachKey
    );
    const conditionPenalty = activeConditions.length * -1;

    let totalMod = approachMod + dialogResult.spend + unskilledPenalty + conditionPenalty;
    let exploitBonus = 0;
    if (dialogResult.exploit) {
      if (dialogResult.spend > 0) {
        exploitBonus = 2;
        totalMod += 2;
      } else {
        ui.notifications.warn("Exploit Point ignored: you must spend at least 1 Pool Point.");
      }
    }

    const roll = new Roll(`2d6 + @mod`, { mod: totalMod });
    await roll.evaluate();

    // Deduct Ability pool after roll commits
    if (dialogResult.spend > 0) {
      await this.update({
        [`system.abilities.general.${abilityKey}.value`]: Math.max(0, currentPool - dialogResult.spend)
      });
    }

    let breakdownHTML = `
      <div class="bdnd-breakdown-row bdnd-info"><span>Ability (${rollTitle}, Rtg ${ability.rating}):</span><em>sets pool size only</em></div>
      <div class="bdnd-breakdown-row"><span>Approach (${approachLabel}):</span><strong>+${approachMod}</strong></div>
      <div class="bdnd-breakdown-row"><span>Pool Spent:</span><strong>+${dialogResult.spend}</strong></div>
    `;
    if (unskilledPenalty !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Unskilled:</span><strong>−2</strong></div>`;
    if (exploitBonus !== 0)     breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>Exploit Point:</span><strong>+2</strong></div>`;
    if (conditionPenalty !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Condition (${activeConditions.length}×):</span><strong>${conditionPenalty}</strong></div>`;

    // Cherry reminder in chat card
    if (cherryName) {
      const postRollNote = hasPostRollSpend
        ? `<div class="bdnd-cherry-card-note">★ <strong>${cherryName}:</strong> Spend 2 pool points to add +1 to this result.</div>`
        : `<div class="bdnd-cherry-card-note">★ <strong>${cherryName}</strong> — see Cherry for special options.</div>`;
      breakdownHTML += postRollNote;
    }

    if (isContest) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="bdnd-roll">
            <h2>⚔ Contest: ${rollTitle}</h2>
            <div class="roll-details">${breakdownHTML}</div>
            <div class="dice-result">
              <h3>Result: ${roll.total}</h3>
              <div class="tn-label">GM compares against opposing roll — higher wins.</div>
            </div>
          </div>
        `,
        type: ChatMessage.TYPES.ROLL,
        rolls: [roll]
      });
    } else {
      const COMBAT_ABILITIES = new Set(['weapons', 'scuffling', 'firearms', 'artillery', 'traps_bombs']);
      const RANGED_ABILITIES  = new Set(['firearms', 'artillery', 'traps_bombs']);
      await this._postRollMessage({
        title: rollTitle, roll, tn: dialogResult.tn, breakdownHTML,
        isCombat: COMBAT_ABILITIES.has(abilityKey),
        isRanged:  RANGED_ABILITIES.has(abilityKey)
      });
    }
  }

  /* -------------------------------------------- */

  async rollClutchTest() {
    // RAW: 2d6, no Rating added, TN always 6.
    // Spend points from a relevant General Ability pool (usually Athletics).
    // GM may allow Interpersonal Ability pool spend for Stability-related Clutch Tests.
    const generalAbilities = this.system.abilities.general;

    const abilityOptions = Object.entries(generalAbilities)
      .sort(([a], [b]) => {
        if (a === 'athletics') return -1;
        if (b === 'athletics') return 1;
        return a.localeCompare(b);
      })
      .map(([key, data]) => {
        const label = BDNDActor.formatKey(key);
        return `<option value="${key}" ${key === 'athletics' ? 'selected' : ''}>${label} (Pool: ${data.value ?? 0})</option>`;
      }).join('');

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: `Clutch Test`,
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">
              <strong>Clutch Test:</strong> 2d6 + Pool Points spent vs TN 6.<br>
              <em>No Approach Rating is added. Spend from a relevant Ability pool
              (usually Athletics; GM may allow Interpersonal Ability for Stability tests).</em>
            </p>
            <div class="form-group">
              <label>Spend Points From Ability:</label>
              <select name="abilityKey" style="width:100%;">${abilityOptions}</select>
            </div>
            <div class="form-group">
              <label>Points to Spend (optional):</label>
              <input type="number" name="spend" value="0" min="0" autofocus/>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Roll Clutch",
            icon: "<i class='fas fa-heartbeat'></i>",
            callback: (html) => resolve({
              abilityKey: html.find('[name="abilityKey"]').val(),
              spend: parseInt(html.find('[name="spend"]').val()) || 0
            })
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const ability = generalAbilities[dialogResult.abilityKey];
    const abilityLabel = BDNDActor.formatKey(dialogResult.abilityKey);
    const currentPool = ability?.value ?? 0;
    const finalSpend = Math.min(dialogResult.spend, currentPool);

    if (dialogResult.spend > currentPool) {
      ui.notifications.warn(`Only ${currentPool} points available in ${abilityLabel}. Spending ${finalSpend}.`);
    }

    const roll = new Roll(`2d6 + @spend`, { spend: finalSpend });
    await roll.evaluate();

    if (finalSpend > 0) {
      await this.update({
        [`system.abilities.general.${dialogResult.abilityKey}.value`]: Math.max(0, currentPool - finalSpend)
      });
    }

    const breakdownHTML = `
      <div class="bdnd-breakdown-row"><span>Ability Spent From:</span><strong>${abilityLabel}</strong></div>
      <div class="bdnd-breakdown-row"><span>Pool Spent:</span><strong>+${finalSpend}</strong></div>
      <div class="bdnd-breakdown-row bdnd-info"><span>No Approach Rating added (RAW)</span></div>
    `;

    await this._postRollMessage({
      title: 'Clutch Test', roll, tn: 6, breakdownHTML,
      successLabel: 'SURVIVED!',
      failLabel: 'FAILED — Take Condition or Taken Out'
    });
  }

  /* -------------------------------------------- */
  /*  Stability Test                               */
  /* -------------------------------------------- */

  async rollStabilityTest() {
    const approaches = this.system.approaches;
    // SHAMUS: Stability Tests use Slick, Charismatic (Flashy), Focused, Deceptive.
    const allowedApproaches = ["slick", "flashy", "focused", "deceptive"];

    let approachOptions = '';
    for (const key of allowedApproaches) {
      if (approaches[key]) {
        const d = approaches[key];
        approachOptions += `<option value="${key}">${d.label} (Rtg: ${d.rating}, Pool: ${d.value ?? 0})</option>`;
      }
    }

    // SHAMUS: Incident severity table — determines how much the counter rises on failure.
    const incidents = [
      { label: "Human attacks with intent to harm",          loss: 2 },
      { label: "Accident serious enough to risk injury",     loss: 2 },
      { label: "Human attacks with intent to kill",          loss: 3 },
      { label: "See a supernatural creature (distance)",     loss: 3 },
      { label: "See a supernatural creature (up close)",     loss: 4 },
      { label: "See a grisly murder or accident scene",      loss: 4 },
      { label: "Learn a friend/loved one was killed",        loss: 4 },
      { label: "Discover corpse of friend/loved one",        loss: 6 },
      { label: "Attacked by a supernatural creature",        loss: 7 },
      { label: "See a friend/loved one killed",              loss: 7 },
      { label: "Friend/loved one killed gruesomely",         loss: 8 },
    ];

    const incidentOptions = incidents
      .map((inc, i) => `<option value="${inc.loss}" ${i === 0 ? 'selected' : ''}>${inc.label} (+${inc.loss})</option>`)
      .join('');

    const currentStability = this.system.stability?.value ?? 0;
    const stabilityMax     = this.system.stability?.max   ?? 8;

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: `Stability Test`,
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">
              <strong>Stability Test (SHAMUS).</strong><br>
              On a <em>failure</em>, the Stability Risk Counter rises by the incident amount.
              At max, the character is taken out of commission.
              Approach pool spend is lost win or lose.
            </p>
            <div class="form-group">
              <label>Incident Severity:</label>
              <select name="incident" style="width:100%;">${incidentOptions}</select>
            </div>
            <div class="form-group">
              <label>Custom Counter Rise <span class="field-hint">(overrides table if set)</span>:</label>
              <input type="number" name="customLoss" value="" min="1" max="20"
                     placeholder="Leave blank to use incident table"/>
            </div>
            <div class="form-group">
              <label>Target Number (GM sets, typically 5–8):</label>
              <input type="number" name="tn" value="8" min="2" max="13"/>
            </div>
            <div class="form-group">
              <label>Select Approach:</label>
              <select name="approachKey" style="width:100%;">${approachOptions}</select>
            </div>
            <div class="form-group">
              <label>Spend Approach Pool Points <span class="field-hint">(lost win or lose)</span>:</label>
              <input type="number" name="spend" value="0" min="0" autofocus/>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Roll Stability",
            icon: "<i class='fas fa-brain'></i>",
            callback: (html) => {
              const customLoss = parseInt(html.find('[name="customLoss"]').val());
              resolve({
                approachKey: html.find('[name="approachKey"]').val(),
                spend:       parseInt(html.find('[name="spend"]').val()) || 0,
                tn:          parseInt(html.find('[name="tn"]').val()) || 5,
                loss:        isNaN(customLoss) ? parseInt(html.find('[name="incident"]').val()) : customLoss
              });
            }
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const selectedApproach = approaches[dialogResult.approachKey];
    const approachMod  = selectedApproach?.rating ?? 0;
    const currentPool  = selectedApproach?.value  ?? 0;
    const finalSpend   = Math.min(dialogResult.spend, currentPool);

    if (dialogResult.spend > currentPool) {
      ui.notifications.warn(`Only ${currentPool} points available. Spending ${finalSpend}.`);
    }

    const activeConditions = this.items.filter(
      i => i.type === "condition" && i.system.approach === dialogResult.approachKey
    );
    const conditionPenalty = activeConditions.length * -1;
    const totalMod = approachMod + finalSpend + conditionPenalty;

    const roll = new Roll(`2d6 + @mod`, { mod: totalMod });
    await roll.evaluate();

    // Approach pool spend is lost regardless of outcome (SHAMUS RAW)
    const updates = {};
    if (finalSpend > 0) {
      updates[`system.approaches.${dialogResult.approachKey}.value`] = Math.max(0, currentPool - finalSpend);
    }

    const succeeded = roll.total >= dialogResult.tn;

    // On failure: Stability Risk Counter rises
    let stabilityRise = 0;
    if (!succeeded) {
      stabilityRise = dialogResult.loss;
      const newStability = Math.min(stabilityMax, currentStability + stabilityRise);
      updates[`system.stability.value`] = newStability;
      if (newStability >= stabilityMax) {
        ui.notifications.warn(`${this.name}'s Stability Risk Counter is maxed out — taken out of commission!`);
      }
    }

    if (Object.keys(updates).length > 0) await this.update(updates);

    let breakdownHTML = `
      <div class="bdnd-breakdown-row"><span>Approach (${selectedApproach?.label}):</span><strong>+${approachMod}</strong></div>
      <div class="bdnd-breakdown-row"><span>Pool Spent (lost regardless):</span><strong>${finalSpend}</strong></div>
    `;
    if (conditionPenalty !== 0) {
      breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Condition (${activeConditions.length}×):</span><strong>${conditionPenalty}</strong></div>`;
    }
    if (!succeeded) {
      const newStab = Math.min(stabilityMax, currentStability + stabilityRise);
      breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Stability Counter:</span><strong>+${stabilityRise} (${currentStability} → ${newStab} / ${stabilityMax})</strong></div>`;
    }

    const dieResult = roll.terms[0]?.results?.[0]?.result;
    if (dieResult === 1) {
      breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>⚠ Complication (natural 1)</span></div>`;
    }

    const newStabFinal = Math.min(stabilityMax, currentStability + stabilityRise);
    await this._postRollMessage({
      title: 'Stability Test',
      roll,
      tn: dialogResult.tn,
      breakdownHTML,
      successLabel: 'STEADFAST — Stability counter unchanged',
      failLabel:    `SHAKEN — Stability +${stabilityRise}${newStabFinal >= stabilityMax ? ' — TAKEN OUT!' : ''}`
    });
  }

  async rollContest(options = {}) {
    // Contest is a standard General Ability test with the same mechanics —
    // Ability Rating + Approach Rating + Ability pool spend. The only difference
    // is the chat card posts the raw result for GM comparison instead of a
    // success/failure verdict against a fixed TN.
    const general = this.system.abilities?.general ?? {};

    const abilityOptions = Object.entries(general)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) =>
        `<option value="${key}">${BDNDActor.formatKey(key)} (Rtg ${data.rating ?? 0}, Pool ${data.value ?? 0})</option>`
      ).join('');

    const chosenKey = await new Promise((resolve) => {
      new Dialog({
        title: options.title ?? "Contest Roll — Choose Ability",
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">
              <strong>Contest:</strong> Select the Ability governing this contest.
              The next dialog will let you choose your Approach and spend pool points.
            </p>
            <div class="form-group">
              <label>Ability:</label>
              <select name="abilityKey" style="width:100%;">${abilityOptions}</select>
            </div>
          </form>
        `,
        buttons: {
          next: {
            label: "Next →",
            icon: "<i class='fas fa-swords'></i>",
            callback: (html) => resolve(html.find('[name="abilityKey"]').val())
          }
        },
        default: "next",
        close: () => resolve(null)
      }).render(true);
    });

    if (!chosenKey) return;
    await this.rollGeneralAbility(chosenKey, { isContest: true, title: options.title });
  }

  /* -------------------------------------------- */
  /*  Cooperation Roll                             */
  /* -------------------------------------------- */
  async rollCooperation(options = {}) {
    // SHAMUS Cooperation: helpers announce which Ability pool they are spending
    // from in chat first, then the lead roller opens this dialog and enters the
    // total contributed. Only the lead roller's Ability pool is deducted here.
    // Helpers must reduce their own pools on their own sheets.
    const title = options.title || 'Cooperation Roll';
    const general = this.system.abilities?.general ?? {};

    const abilityOptions = Object.entries(general)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) =>
        `<option value="${key}">${BDNDActor.formatKey(key)} (Rtg ${data.rating ?? 0}, Pool ${data.value ?? 0})</option>`
      ).join('');

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title,
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">
              <strong>Cooperation — Lead Roller:</strong> Have helpers announce
              which Ability pool they are spending from and how many points, then
              enter the total here. Helpers deduct their own Ability pools manually.
            </p>
            <div class="form-group">
              <label>Your Ability (governs this test):</label>
              <select name="abilityKey" style="width:100%;">${abilityOptions}</select>
            </div>
            <div class="form-group">
              <label>Target Number (TN):</label>
              <input type="number" name="tn" value="8" min="2" max="13"/>
            </div>
            <div class="form-group">
              <label>Select Approach (adds its Rating free):</label>
              <select name="approachKey" style="width:100%;">
                ${this._buildApproachOptions()}
              </select>
            </div>
            <div class="form-group">
              <label>Your Ability Pool Spend:</label>
              <input type="number" name="spend" value="0" min="0" autofocus/>
            </div>
            <div class="form-group">
              <label>Total Helper Points contributed (sum from all helpers):</label>
              <input type="number" name="helperPoints" value="0" min="0" max="20"/>
            </div>
            <div class="form-group bdnd-exploit-group">
              <label>
                <input type="checkbox" name="exploit"/>
                GM Granted Exploit Point? (+2, requires your own pool spend)
              </label>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Roll (Lead)",
            icon: "<i class='fas fa-people-carry'></i>",
            callback: (html) => resolve({
              abilityKey: html.find('[name="abilityKey"]').val(),
              approachKey: html.find('[name="approachKey"]').val(),
              tn: parseInt(html.find('[name="tn"]').val()) || 5,
              spend: parseInt(html.find('[name="spend"]').val()) || 0,
              helperPoints: Math.min(20, parseInt(html.find('[name="helperPoints"]').val()) || 0),
              exploit: html.find('[name="exploit"]').is(':checked')
            })
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const ability = general[dialogResult.abilityKey];
    if (!ability) return ui.notifications.error(`Ability "${dialogResult.abilityKey}" not found.`);

    const abilityLabel = BDNDActor.formatKey(dialogResult.abilityKey);
    const currentPool = ability.value ?? 0;
    const unskilledPenalty = ability.rating === 0 ? -2 : 0;
    const finalSpend = Math.min(dialogResult.spend, currentPool);

    if (dialogResult.spend > currentPool) {
      ui.notifications.warn(`Only ${currentPool} points available in ${abilityLabel} — spending ${finalSpend}.`);
    }

    const selectedApproach = this.system.approaches[dialogResult.approachKey];
    const approachMod = selectedApproach?.rating ?? 0;
    const approachLabel = selectedApproach?.label ?? dialogResult.approachKey;

    const activeConditions = this.items.filter(
      i => i.type === "condition" && i.system.approach === dialogResult.approachKey
    );
    const conditionPenalty = activeConditions.length * -1;

    let totalMod = approachMod + finalSpend + dialogResult.helperPoints + unskilledPenalty + conditionPenalty;
    let exploitBonus = 0;
    if (dialogResult.exploit) {
      if (finalSpend > 0) { exploitBonus = 2; totalMod += 2; }
      else ui.notifications.warn("Exploit Point ignored: you must spend at least 1 of your own pool points.");
    }

    const roll = new Roll(`2d6 + @mod`, { mod: totalMod });
    await roll.evaluate();

    // Deduct lead roller's Ability pool only
    if (finalSpend > 0) {
      await this.update({
        [`system.abilities.general.${dialogResult.abilityKey}.value`]: Math.max(0, currentPool - finalSpend)
      });
    }

    let breakdownHTML = `
      <div class="bdnd-breakdown-row bdnd-info"><span>Ability (${abilityLabel}, Rtg ${ability.rating}):</span><em>sets pool size only</em></div>
      <div class="bdnd-breakdown-row"><span>Approach (${approachLabel}):</span><strong>+${approachMod}</strong></div>
      <div class="bdnd-breakdown-row"><span>Your Pool Spent:</span><strong>+${finalSpend}</strong></div>
      <div class="bdnd-breakdown-row bdnd-bonus"><span>Helper Points:</span><strong>+${dialogResult.helperPoints}</strong></div>
    `;
    if (unskilledPenalty !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Unskilled:</span><strong>−2</strong></div>`;
    if (exploitBonus) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>Exploit Point:</span><strong>+2</strong></div>`;
    if (conditionPenalty) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Conditions:</span><strong>${conditionPenalty}</strong></div>`;

    const dieResult = roll.terms[0]?.results?.[0]?.result;
    if (dieResult === 1) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>⚠ Complication (natural 1)</span></div>`;

    await this._postRollMessage({ title, roll, tn: dialogResult.tn, breakdownHTML });
  }


  /* -------------------------------------------- */
  /*  Investigative Ability Spend                  */
  /* -------------------------------------------- */

  async spendReassurance() {
    const ability = this.system.abilities.investigative['reassurance'];
    const available = ability?.value ?? 0;

    if (available <= 0) {
      return ui.notifications.warn("No Reassurance points remaining.");
    }

    // Build a dropdown of all character-type actors
    const characters = game.actors.filter(a => a.type === 'character');
    if (characters.length === 0) {
      return ui.notifications.warn("No character actors found to reassure.");
    }
    const charOptions = characters.map(a => {
      const stab = a.system.stability?.value ?? 0;
      const max  = a.system.stability?.max   ?? 8;
      return `<option value="${a.id}" ${a.id === this.id ? 'selected' : ''}>${a.name} (Stability: ${stab}/${max})</option>`;
    }).join('');

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: 'Spend Reassurance',
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note">
              <strong>Reassurance</strong> — each point spent lowers the target's
              Stability Risk Counter by <strong>2</strong> (RAW). Pool available: <strong>${available}</strong>.
            </p>
            <div class="form-group">
              <label>Target Character:</label>
              <select name="targetId" style="width:100%;">${charOptions}</select>
            </div>
            <div class="form-group">
              <label>Points to Spend (Max: ${available}):</label>
              <input type="number" name="spend" value="1" min="1" max="${available}" autofocus/>
            </div>
          </form>
        `,
        buttons: {
          spend: {
            label: "Spend",
            icon: "<i class='fas fa-heart'></i>",
            callback: (html) => resolve({
              targetId: html.find('[name="targetId"]').val(),
              spend:    Math.min(available, Math.max(1, parseInt(html.find('[name="spend"]').val()) || 1))
            })
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "spend",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const targetActor = game.actors.get(dialogResult.targetId);
    if (!targetActor) return ui.notifications.error("Target character not found.");

    const finalSpend      = Math.min(dialogResult.spend, available);
    const currentStab     = targetActor.system.stability?.value ?? 0;
    // RAW: each Reassurance point spent reduces the Stability Risk Counter by 2
    const newStab         = Math.max(0, currentStab - (finalSpend * 2));

    // Deduct from this actor's Reassurance pool
    await this.update({
      'system.abilities.investigative.reassurance.value': Math.max(0, available - finalSpend)
    });

    // Reduce the target's Stability Risk Counter
    await targetActor.update({ 'system.stability.value': newStab });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-spend">
          <h3><i class="fas fa-heart"></i> Reassurance</h3>
          <p><strong>${this.name}</strong> spent <strong>${finalSpend}</strong> Reassurance point(s)
             on <strong>${targetActor.name}</strong>, reducing Stability by ${finalSpend * 2}.</p>
          <p>Stability Counter: <strong>${currentStab} → ${newStab}</strong>
             / ${targetActor.system.stability?.max ?? 10}</p>
          ${newStab === 0 ? '<p class="bdnd-result-success">Stability fully cleared!</p>' : ''}
        </div>
      `
    });
  }

  async spendInvestigativeAbility(abilityKey) {
    const ability = this.system.abilities.investigative[abilityKey];
    const label = BDNDActor.formatKey(abilityKey);

    if (!ability || ability.value <= 0) {
      ui.notifications.warn(`No points remaining in ${label}.`);
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Spend Investigative Point?",
      content: `<p>Spend 1 point of <strong>${label.toUpperCase()}</strong> to gain a clue or benefit?</p>`
    });

    if (!confirmed) return;

    await this.update({
      [`system.abilities.investigative.${abilityKey}.value`]: ability.value - 1
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-spend">
          <h3>Investigative Spend</h3>
          <p><strong>${this.name}</strong> spent a point of <span class="bdnd-ability-name">${label.toUpperCase()}</span>.</p>
          <p class="points-remaining">Points remaining: ${ability.value - 1}</p>
        </div>
      `
    });
  }

  /* -------------------------------------------- */
  /*  Spell Casting                                */
  /* -------------------------------------------- */

  async castSpell(itemId) {
    const spell = this.items.get(itemId);
    if (!spell) return;

    const level = Number(spell.system.level) || 1;
    const defaultTN = Number(spell.system.target_tn) || 5;
    const abilityKey = "spell_casting";
    const ability = this.system.abilities.general[abilityKey];

    if (!ability) return ui.notifications.error("You do not have the Spell Casting ability.");

    const currentPool = ability.value ?? 0;
    if (currentPool < level) {
      return ui.notifications.warn(`Not enough Spell Casting pool to cast a Level ${level} spell (need ${level}, have ${currentPool}).`);
    }

    const maxExtraSpend = currentPool - level;
    const unskilledPenalty = ability.rating === 0 ? -2 : 0;

    const dialogResult = await new Promise((resolve) => {
      new Dialog({
        title: `Cast Spell: ${spell.name}`,
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note bdnd-spell-note">
              Base Cost: <strong>${level}</strong> Pool Point(s) + <strong>${level}</strong> Stability Damage.
            </p>
            <div class="form-group">
              <label>Spell Casting Rating: <strong>${ability.rating}</strong>
                ${unskilledPenalty !== 0 ? '<span class="bdnd-unskilled">(Unskilled -2)</span>' : ''}
              </label>
            </div>
            <div class="form-group">
              <label>Target Number (TN):</label>
              <input type="number" name="tn" value="${defaultTN}" min="2" max="15"/>
            </div>
            <div class="form-group">
              <label>Select Approach:</label>
              <select name="approachKey" style="width:100%;">
                ${this._buildApproachOptions()}
              </select>
            </div>
            <div class="form-group">
              <label>Extra Pool Spend (Max: ${maxExtraSpend}, on top of base cost):</label>
              <input type="number" name="spend" value="0" min="0" max="${maxExtraSpend}" autofocus/>
            </div>
            <div class="form-group bdnd-exploit-group">
              <label>
                <input type="checkbox" name="exploit"/>
                GM Granted Exploit Point? (+2, requires extra pool spend)
              </label>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Cast",
            icon: "<i class='fas fa-magic'></i>",
            callback: (html) => resolve({
              tn: parseInt(html.find('[name="tn"]').val()) || 5,
              approachKey: html.find('[name="approachKey"]').val(),
              spend: parseInt(html.find('[name="spend"]').val()) || 0,
              exploit: html.find('[name="exploit"]').is(':checked')
            })
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });

    if (!dialogResult) return;

    const selectedApproach = this.system.approaches[dialogResult.approachKey];
    const approachMod = selectedApproach?.rating ?? 0;
    const approachLabel = selectedApproach?.label ?? dialogResult.approachKey;

    const activeConditions = this.items.filter(
      i => i.type === "condition" && i.system.approach === dialogResult.approachKey
    );
    const conditionPenalty = activeConditions.length * -1;

    const extraSpend = Math.min(dialogResult.spend, maxExtraSpend);
    const totalPoolDeduction = level + extraSpend;
    let totalMod = approachMod + extraSpend + unskilledPenalty + conditionPenalty;

    let exploitBonus = 0;
    if (dialogResult.exploit) {
      if (extraSpend > 0) {
        exploitBonus = 2;
        totalMod += 2;
      } else {
        ui.notifications.warn("Exploit Point ignored: you must spend extra pool points beyond the base cost.");
      }
    }

    const roll = new Roll(`2d6 + @mod`, { mod: totalMod });
    await roll.evaluate();

    // Deduct pool and apply stability damage (clamped to max)
    const newPool = Math.max(0, currentPool - totalPoolDeduction);
    const currentStability = this.system.stability.value ?? 0;
    const stabilityMax = this.system.stability.max ?? 8;
    const newStability = Math.min(stabilityMax, currentStability + level);

    await this.update({
      [`system.abilities.general.${abilityKey}.value`]: newPool,
      "system.stability.value": newStability
    });

    if (currentStability + level >= stabilityMax) {
      ui.notifications.warn(`${this.name} has reached maximum Stability Risk — Taken Out condition applies!`);
    }

    let breakdownHTML = `
      <div class="bdnd-breakdown-row bdnd-spell-cost"><span>Base Cost:</span><strong>${level} Pool + ${level} Stability Dmg</strong></div>
      <div class="bdnd-breakdown-row"><span>Approach (${approachLabel}):</span><strong>+${approachMod}</strong></div>
      <div class="bdnd-breakdown-row"><span>Extra Pool Spent:</span><strong>${extraSpend}</strong></div>
    `;
    if (unskilledPenalty !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Unskilled:</span><strong>-2</strong></div>`;
    if (exploitBonus !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>Exploit Point:</span><strong>+2</strong></div>`;
    if (conditionPenalty !== 0) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-malus"><span>Conditions:</span><strong>${conditionPenalty}</strong></div>`;

    await this._postRollMessage({
      title: `<i class="fas fa-magic"></i> Cast: ${spell.name}`,
      roll, tn: dialogResult.tn, breakdownHTML,
      successLabel: 'SPELL CAST SUCCESSFULLY',
      failLabel: 'SPELL FAILED',
      colorAccent: 'purple'
    });
  }

  /* -------------------------------------------- */
  /*  Refresh Event                                */
  /* -------------------------------------------- */

  async doRefreshEvent() {
    const confirmed = await Dialog.confirm({
      title: "Refresh Event",
      content: `
        <p>This will restore <strong>all</strong> General Ability, Investigative Ability, and Approach pools to their Rating values.</p>
        <p><em>Stability Risk Counter is not affected — it can only be reduced via Reassurance.</em></p>
      `
    });
    if (!confirmed) return;

    const updates = {};

    // Restore General Ability pools
    const general = this.system.abilities?.general ?? {};
    for (const [key, ability] of Object.entries(general)) {
      updates[`system.abilities.general.${key}.value`] = ability.rating ?? 0;
    }

    // Restore Investigative Ability pools (SHAMUS: all pools restored on Refresh)
    const investigative = this.system.abilities?.investigative ?? {};
    for (const [key, ability] of Object.entries(investigative)) {
      updates[`system.abilities.investigative.${key}.value`] = ability.rating ?? 0;
    }

    // Restore Approach pools
    const approaches = this.system.approaches ?? {};
    for (const [key, approach] of Object.entries(approaches)) {
      updates[`system.approaches.${key}.value`] = approach.rating ?? 0;
    }

    await this.update(updates);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-spend">
          <h3>⚓ Refresh Event</h3>
          <p><strong>${this.name}</strong>'s General, Investigative, and Approach pools have been restored to their Ratings.</p>
          <p><em>Stability Risk Counter unchanged — reduce via Reassurance.</em></p>
        </div>
      `
    });

    ui.notifications.info(`${this.name}: Refresh Event complete.`);
  }

  /* -------------------------------------------- */
  /*  Advancement — Raise Ability Rating           */
  /* -------------------------------------------- */

  /**
   * Spend 1 Build Point to raise an ability's Rating by 1.
   * @param {string} abilityType  'general' or 'investigative'
   * @param {string} abilityKey   The ability key (e.g. 'athletics', 'reassurance')
   */
  async raiseRating(abilityType, abilityKey) {
    const bp = this.system.build_points?.value ?? 0;
    const ability = this.system.abilities?.[abilityType]?.[abilityKey];
    if (!ability) return ui.notifications.error(`Ability not found: ${abilityKey}`);

    const label = BDNDActor.formatKey(abilityKey);
    const currentRating = ability.rating ?? 0;
    const newRating = currentRating + 1;

    if (bp < 1) {
      return ui.notifications.warn(`No Build Points remaining — cannot raise ${label}.`);
    }

    const confirmed = await Dialog.confirm({
      title: `Raise ${label}?`,
      content: `
        <form class="bdnd-dialog">
          <p>Spend <strong>1 Build Point</strong> to raise <strong>${label}</strong>
             from Rating ${currentRating} to Rating ${newRating}?</p>
          <p class="bdnd-rule-note">Build Points available: <strong>${bp}</strong></p>
        </form>
      `
    });
    if (!confirmed) return;

    await this.update({
      'system.build_points.value': bp - 1,
      [`system.abilities.${abilityType}.${abilityKey}.rating`]: newRating
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-spend">
          <h3>📈 Advancement</h3>
          <p><strong>${this.name}</strong> raised <em>${label}</em>
             from Rating&nbsp;${currentRating} to Rating&nbsp;${newRating}.</p>
          <p class="bdnd-rule-note">Build Points remaining: ${bp - 1}</p>
        </div>
      `
    });

    ui.notifications.info(`${label} raised to ${newRating}. Build Points remaining: ${bp - 1}`);
  }

}
