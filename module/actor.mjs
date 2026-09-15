const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;

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
    if (actorData.type === 'character' || actorData.type === 'npc') this._prepareCharacterData(actorData);
  }

  /**
   * Auto-configure default token resource bars for PC and NPC actors.
   * Fires once when the actor is first created, before it is saved.
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    if (this.type === 'character' || this.type === 'npc') {
      this.prototypeToken.updateSource({
        bar1: { attribute: 'health' },
        bar2: { attribute: 'stability' }
      });
    }
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
  async _postRollMessage({ title, roll, tn, breakdownHTML, successLabel, failLabel, colorAccent = '', isCombat = false, isRanged = false, weapon = null }) {
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

    // Auto damage roll — only on a hit when the attack was initiated from a weapon item
    let damageRoll = null;
    let damageHTML = '';
    if (isSuccess && weapon) {
      const bonus = weapon.system.bonus ?? 0;
      damageRoll = new Roll(`1d6 + ${bonus}`);
      await damageRoll.evaluate();
      const dieResult = damageRoll.terms[0]?.results?.[0]?.result ?? '?';
      const bonusStr  = bonus !== 0 ? ` + ${bonus}` : '';
      damageHTML = `
        <div class="bdnd-damage-result">
          <span class="bdnd-damage-label">💥 Damage:</span>
          <strong>${damageRoll.total}</strong>
          <span class="tn-label">(1d6[${dieResult}]${bonusStr} — ${weapon.name})</span>
        </div>`;
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
          ${damageHTML}
          ${greaterSuccessHTML}
          ${complicationHTML}
        </div>
      `,
      rolls: damageRoll ? [roll, damageRoll] : [roll]
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

    // Identify combat abilities for flanking / range-band features
    const ALL_COMBAT_ABS    = new Set(['weapons', 'scuffling', 'firearms', 'artillery', 'traps_bombs']);
    const isCombatAbility   = ALL_COMBAT_ABS.has(abilityKey);

    // Flanking checkbox — combat attacks only, not contests
    const flankingField = isCombatAbility && !isContest ? `
      <div class="form-group bdnd-exploit-group">
        <label>
          <input type="checkbox" name="flanking" onchange="
            const tn = this.closest('form').querySelector('[name=tn]');
            tn.value = parseInt(tn.value) + (this.checked ? -2 : 2);
          "/>
          Flanking Advantage? (−2 TN, attacking from behind)
        </label>
      </div>` : '';

    // Range band dropdown — only for ranged combat abilities, not for contests
    const RANGED_ATTACK_ABILITIES = new Set(['firearms', 'artillery', 'traps_bombs']);
    const isRangedAttack = RANGED_ATTACK_ABILITIES.has(abilityKey) && !isContest;
    const rangeBandField = isRangedAttack ? `
      <div class="form-group">
        <label>Range Band (sets TN):</label>
        <select name="rangeBand" style="width:100%;" onchange="
          const m={pointblank:6,standard:8,medium:10,long:12};
          this.closest('form').querySelector('[name=tn]').value = m[this.value] ?? 8;
        ">
          <option value="pointblank">Point Blank / Exposed — TN 6</option>
          <option value="standard" selected>Standard — TN 8</option>
          <option value="medium">Medium — TN 10</option>
          <option value="long">Long — TN 12</option>
        </select>
      </div>` : '';

    // Check for a Cherry on this ability
    const cherry = this.items.find(i => i.type === 'cherry' && i.system.ability === abilityKey);
    const cherryName = cherry?.name ?? null;
    const hasPostRollSpend = cherry?.system.has_post_roll_spend ?? false;

    // Contest mode: no TN field; otherwise pre-fill from options (e.g. Flee sets TN automatically)
    const defaultTN = options.tn ?? 8;
    const tnField = isContest
      ? `<p class="bdnd-rule-note">
           <strong>Contest:</strong> Both sides roll independently.
           The GM compares results — higher wins. Ask your opponent to also roll their side.
         </p>`
      : `<div class="form-group">
           <label>Target Number (TN):</label>
           <input type="number" name="tn" value="${defaultTN}" min="2" max="13"/>
         </div>`;

    // Cherry reminder shown in dialog
    const cherryBlock = cherryName ? `
      <div class="bdnd-cherry-notice">
        <i class="fas fa-star"></i> Cherry: <strong>${cherryName}</strong>
        ${hasPostRollSpend ? '— Post-roll spend available (spend 2 after result for +1)' : ''}
      </div>` : '';

    const dialogResult = await DialogV2.prompt({
      window: { title: isContest ? `Contest: ${rollTitle}` : `Test: ${rollTitle}` },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
          ${rangeBandField}
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
          ${flankingField}
          <div class="form-group bdnd-exploit-group">
            <label>
              <input type="checkbox" name="exploit"/>
              GM Granted Exploit Point? (+2, requires pool spend)
            </label>
          </div>
        </form>
      `,
      ok: {
        label: isContest ? "Roll My Side" : "Roll Die",
        icon: isContest ? "fas fa-swords" : "fas fa-dice",
        callback: (event, button) => {
          const fd = new FormDataExtended(button.form).object;
          return {
            tn: parseInt(fd.tn) || 8,
            rangeBand: fd.rangeBand || null,
            flanking: !!fd.flanking,
            approachKey: fd.approachKey,
            spend: parseInt(fd.spend) || 0,
            exploit: !!fd.exploit
          };
        }
      },
      rejectClose: false
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
    if (dialogResult.rangeBand) {
      const rangeBandLabels = { pointblank: 'Point Blank / Exposed', standard: 'Standard', medium: 'Medium', long: 'Long' };
      breakdownHTML += `<div class="bdnd-breakdown-row"><span>Range Band:</span><strong>${rangeBandLabels[dialogResult.rangeBand] ?? dialogResult.rangeBand} (TN ${dialogResult.tn})</strong></div>`;
    }
    if (dialogResult.flanking) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>Flanking Advantage:</span><strong>−2 TN</strong></div>`;
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
        rolls: [roll]
      });
    } else {
      const COMBAT_ABILITIES = new Set(['weapons', 'scuffling', 'firearms', 'artillery', 'traps_bombs']);
      const RANGED_ABILITIES  = new Set(['firearms', 'artillery', 'traps_bombs']);
      await this._postRollMessage({
        title: rollTitle, roll, tn: dialogResult.tn, breakdownHTML,
        isCombat: COMBAT_ABILITIES.has(abilityKey),
        isRanged:  RANGED_ABILITIES.has(abilityKey),
        weapon:    options.weapon ?? null
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

    const dialogResult = await DialogV2.prompt({
      window: { title: `Clutch Test` },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
      ok: {
        label: "Roll Clutch",
        icon: "fas fa-heartbeat",
        callback: (event, button) => {
          const fd = new FormDataExtended(button.form).object;
          return { abilityKey: fd.abilityKey, spend: parseInt(fd.spend) || 0 };
        }
      },
      rejectClose: false
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

    const dialogResult = await DialogV2.prompt({
      window: { title: `Stability Test` },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
      ok: {
        label: "Roll Stability",
        icon: "fas fa-brain",
        callback: (event, button) => {
          const fd = new FormDataExtended(button.form).object;
          const customLoss = parseInt(fd.customLoss);
          return {
            approachKey: fd.approachKey,
            spend:       parseInt(fd.spend) || 0,
            tn:          parseInt(fd.tn) || 5,
            loss:        isNaN(customLoss) ? parseInt(fd.incident) : customLoss
          };
        }
      },
      rejectClose: false
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

    const chosenKey = await DialogV2.prompt({
      window: { title: options.title ?? "Contest Roll — Choose Ability" },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
      ok: {
        label: "Next →",
        icon: "fas fa-swords",
        callback: (event, button) => new FormDataExtended(button.form).object.abilityKey
      },
      rejectClose: false
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

    const dialogResult = await DialogV2.prompt({
      window: { title },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
      ok: {
        label: "Roll (Lead)",
        icon: "fas fa-people-carry",
        callback: (event, button) => {
          const fd = new FormDataExtended(button.form).object;
          return {
            abilityKey: fd.abilityKey,
            approachKey: fd.approachKey,
            tn: parseInt(fd.tn) || 5,
            spend: parseInt(fd.spend) || 0,
            helperPoints: Math.min(20, parseInt(fd.helperPoints) || 0),
            exploit: !!fd.exploit
          };
        }
      },
      rejectClose: false
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

    const dialogResult = await DialogV2.prompt({
      window: { title: 'Spend Reassurance' },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
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
      ok: {
        label: "Spend",
        icon: "fas fa-heart",
        callback: (event, button) => {
          const fd = new FormDataExtended(button.form).object;
          return {
            targetId: fd.targetId,
            spend:    Math.min(available, Math.max(1, parseInt(fd.spend) || 1))
          };
        }
      },
      buttons: [{ action: "cancel", label: "Cancel", callback: () => null }],
      rejectClose: false
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

    const confirmed = await DialogV2.confirm({
      window: { title: "Spend Investigative Point?" },
      content: `<p>Spend 1 point of <strong>${label.toUpperCase()}</strong> to gain a clue or benefit?</p>`,
      rejectClose: false
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

    const level     = Math.min(3, Math.max(1, Number(spell.system.level) || 1));
    const spellType = spell.system.spell_type ?? 'casting';  // 'casting' | 'concoction'
    const baseSta   = level * 2;                             // RAW: Lv1=2, Lv2=4, Lv3=6

    // ── Which ability pool to draw from ───────────────────────────────────
    // Casting Ability spells → Spell Casting (General)
    // Concoction / Ritual    → Voodoo (Investigative)
    const isCasting    = spellType === 'casting';
    const abilityKey   = isCasting ? 'spell_casting' : 'voodoo';
    const abilityGroup = isCasting ? 'general' : 'investigative';
    const ability      = this.system.abilities[abilityGroup]?.[abilityKey];
    const poolLabel    = isCasting ? 'Spell Casting' : 'Voodoo';

    if (!ability || ability.rating === 0) {
      return ui.notifications.error(
        isCasting
          ? `${this.name} has no Spell Casting rating and cannot cast Casting Ability spells.`
          : `${this.name} has no Voodoo rating and cannot perform Concoction rituals.`
      );
    }

    const currentPool = ability.value ?? 0;
    if (currentPool < level) {
      return ui.notifications.warn(
        `Not enough ${poolLabel} pool to cast a Level ${level} spell (need ${level}, have ${currentPool}).`
      );
    }

    // ── Stability reduction fields (shared by both paths) ─────────────────
    const stabReductionFields = `
      <hr style="border-color:#8c6d53; margin:8px 0;">
      <p class="bdnd-rule-note" style="margin-bottom:6px;">
        <strong>Stability Damage:</strong> ${baseSta} points (Level ${level} × 2).
        Reduce with any of the following:
      </p>
      <div class="form-group bdnd-exploit-group">
        <label>
          <input type="checkbox" name="stabCeremony"/>
          Ceremony (dancing, singing, or Loa possession) <strong>−2</strong>
        </label>
      </div>
      <div class="form-group">
        <label>Drive-related spell — spend pool points (0–2, reduces 1 for 1):</label>
        <input type="number" name="stabDriveSpend" value="0" min="0" max="2"/>
      </div>
      <div class="form-group bdnd-exploit-group">
        <label>
          <input type="checkbox" name="stabComponent"/>
          Component / talisman (costs ${level} Coin) <strong>−1</strong>
        </label>
      </div>
      <div class="form-group bdnd-exploit-group">
        <label>
          <input type="checkbox" name="stabLoreSheet"/>
          Spend a Lore Sheet point related to the target <strong>−1</strong>
        </label>
      </div>`;

    // ── CASTING ABILITY SPELL — Test required ──────────────────────────────
    if (isCasting) {
      const defaultTN     = Number(spell.system.target_tn) || 8;
      const maxExtraSpend = currentPool - level;

      const dialogResult = await DialogV2.prompt({
        window: { title: `Cast Spell: ${spell.name}` },
        classes: ["bdnd-dialog"],
        position: { width: 380 },
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note bdnd-spell-note">
              <strong>Casting Ability Spell</strong> — drawn from ${poolLabel} pool (current: ${currentPool}).
              Base cost: <strong>${level}</strong> pool point(s). Test usually TN 8.
            </p>
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
              <label>Extra Pool Spend beyond base cost (max ${maxExtraSpend}, adds +1 per point):</label>
              <input type="number" name="spend" value="0" min="0" max="${maxExtraSpend}" autofocus/>
            </div>
            <div class="form-group bdnd-exploit-group">
              <label>
                <input type="checkbox" name="exploit"/>
                GM Granted Exploit Point? (+2, requires extra pool spend)
              </label>
            </div>
            ${stabReductionFields}
          </form>
        `,
        ok: {
          label: "Cast",
          icon: "fas fa-magic",
          callback: (event, button) => {
            const fd = new FormDataExtended(button.form).object;
            return {
              tn:             parseInt(fd.tn) || 8,
              approachKey:    fd.approachKey,
              spend:          parseInt(fd.spend) || 0,
              exploit:        !!fd.exploit,
              stabCeremony:   !!fd.stabCeremony,
              stabDriveSpend: parseInt(fd.stabDriveSpend) || 0,
              stabComponent:  !!fd.stabComponent,
              stabLoreSheet:  !!fd.stabLoreSheet
            };
          }
        },
        rejectClose: false
      });

      if (!dialogResult) return;

      const selectedApproach = this.system.approaches[dialogResult.approachKey];
      const approachMod      = selectedApproach?.rating ?? 0;
      const approachLabel    = selectedApproach?.label  ?? dialogResult.approachKey;

      const activeConditions = this.items.filter(
        i => i.type === 'condition' && i.system.approach === dialogResult.approachKey
      );
      const conditionPenalty = activeConditions.length * -1;

      const extraSpend    = Math.min(dialogResult.spend, maxExtraSpend);
      const totalPoolCost = level + extraSpend;
      let   totalMod      = approachMod + extraSpend + conditionPenalty;

      let exploitBonus = 0;
      if (dialogResult.exploit) {
        if (extraSpend > 0) { exploitBonus = 2; totalMod += 2; }
        else ui.notifications.warn("Exploit Point ignored — must spend extra pool points beyond the base cost.");
      }

      const roll = new Roll('2d6 + @mod', { mod: totalMod });
      await roll.evaluate();
      const hit = roll.total >= dialogResult.tn;

      // RAW: Stability damage only on success — no damage if the spell fails
      const driveSpend    = Math.min(2, dialogResult.stabDriveSpend);
      const stabReduction = (dialogResult.stabCeremony  ? 2 : 0)
                          + driveSpend
                          + (dialogResult.stabComponent  ? 1 : 0)
                          + (dialogResult.stabLoreSheet  ? 1 : 0);
      const stabilityDmg  = hit ? Math.max(0, baseSta - stabReduction) : 0;

      const newPool          = Math.max(0, currentPool - totalPoolCost);
      const currentStability = this.system.stability.value ?? 0;
      const stabilityMax     = this.system.stability.max   ?? 8;
      const newStability     = Math.min(stabilityMax, currentStability + stabilityDmg);

      const updates = {
        'system.abilities.general.spell_casting.value': newPool,
        'system.stability.value': newStability
      };
      if (driveSpend > 0) {
        const apPath = `system.approaches.${dialogResult.approachKey}.value`;
        updates[apPath] = Math.max(0, (selectedApproach?.value ?? 0) - driveSpend);
      }
      await this.update(updates);

      let breakdownHTML = `
        <div class="bdnd-breakdown-row bdnd-spell-cost">
          <span>Pool Cost (${poolLabel}):</span>
          <strong>${level} base + ${extraSpend} extra = ${totalPoolCost}</strong>
        </div>
        <div class="bdnd-breakdown-row"><span>Approach (${approachLabel}):</span><strong>+${approachMod}</strong></div>
        ${extraSpend    ? `<div class="bdnd-breakdown-row bdnd-bonus"><span>Extra Pool Spend:</span><strong>+${extraSpend}</strong></div>` : ''}
        ${exploitBonus  ? `<div class="bdnd-breakdown-row bdnd-bonus"><span>Exploit Point:</span><strong>+2</strong></div>` : ''}
        ${conditionPenalty ? `<div class="bdnd-breakdown-row bdnd-malus"><span>Conditions:</span><strong>${conditionPenalty}</strong></div>` : ''}
      `;

      if (hit) {
        breakdownHTML += `<div class="bdnd-breakdown-row bdnd-spell-cost">
          <span>Stability Damage:</span>
          <strong>${baseSta} − ${stabReduction} = ${stabilityDmg}</strong>
        </div>`;
        if (dialogResult.stabCeremony)  breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Ceremony:</span><strong>−2</strong></div>`;
        if (driveSpend > 0)             breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Drive spend (${driveSpend} pool):</span><strong>−${driveSpend}</strong></div>`;
        if (dialogResult.stabComponent) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Component (${level} Coin):</span><strong>−1</strong></div>`;
        if (dialogResult.stabLoreSheet) breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Lore Sheet spend:</span><strong>−1</strong></div>`;
      } else {
        breakdownHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>Stability Damage:</span><strong>0 (spell failed)</strong></div>`;
      }

      await this._postRollMessage({
        title:        `<i class="fas fa-magic"></i> Cast: ${spell.name}`,
        roll,
        tn:           dialogResult.tn,
        breakdownHTML,
        successLabel: 'SPELL CAST SUCCESSFULLY',
        failLabel:    'SPELL FAILED — no Stability damage',
        colorAccent:  'purple'
      });

      if (hit && newStability >= stabilityMax) {
        ui.notifications.warn(`${this.name} has reached maximum Stability Risk!`);
      }

    // ── CONCOCTION / RITUAL — always succeeds, no Test needed ─────────────
    } else {
      const dialogResult = await DialogV2.prompt({
        window: { title: `Perform Ritual: ${spell.name}` },
        classes: ["bdnd-dialog"],
        position: { width: 380 },
        content: `
          <form class="bdnd-dialog">
            <p class="bdnd-rule-note bdnd-spell-note">
              <strong>Concoction / Ritual</strong> — drawn from ${poolLabel} pool (current: ${currentPool}).
              Base cost: <strong>${level}</strong> pool point(s).
              <br><em>Rituals always succeed. The GM may call for a Test only to check for complications.</em>
            </p>
            ${stabReductionFields}
          </form>
        `,
        ok: {
          label: "Perform Ritual",
          icon: "fas fa-khanda",
          callback: (event, button) => {
            const fd = new FormDataExtended(button.form).object;
            return {
              stabCeremony:   !!fd.stabCeremony,
              stabDriveSpend: parseInt(fd.stabDriveSpend) || 0,
              stabComponent:  !!fd.stabComponent,
              stabLoreSheet:  !!fd.stabLoreSheet
            };
          }
        },
        rejectClose: false
      });

      if (!dialogResult) return;

      const driveSpend    = Math.min(2, dialogResult.stabDriveSpend);
      const stabReduction = (dialogResult.stabCeremony  ? 2 : 0)
                          + driveSpend
                          + (dialogResult.stabComponent  ? 1 : 0)
                          + (dialogResult.stabLoreSheet  ? 1 : 0);
      const stabilityDmg  = Math.max(0, baseSta - stabReduction);

      const newPool          = Math.max(0, currentPool - level);
      const currentStability = this.system.stability.value ?? 0;
      const stabilityMax     = this.system.stability.max   ?? 8;
      const newStability     = Math.min(stabilityMax, currentStability + stabilityDmg);

      await this.update({
        'system.abilities.investigative.voodoo.value': newPool,
        'system.stability.value': newStability
      });

      let reductionHTML = '';
      if (dialogResult.stabCeremony)  reductionHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Ceremony:</span><strong>−2</strong></div>`;
      if (driveSpend > 0)             reductionHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Drive spend (${driveSpend} from any pool):</span><strong>−${driveSpend}</strong></div>`;
      if (dialogResult.stabComponent) reductionHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Component (${level} Coin):</span><strong>−1</strong></div>`;
      if (dialogResult.stabLoreSheet) reductionHTML += `<div class="bdnd-breakdown-row bdnd-bonus"><span>↳ Lore Sheet spend:</span><strong>−1</strong></div>`;

      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `
          <div class="bdnd-roll bdnd-roll-purple">
            <h2><i class="fas fa-khanda"></i> ${spell.name}</h2>
            <div class="roll-details">
              <div class="bdnd-breakdown-row bdnd-spell-cost">
                <span>Voodoo Pool Cost:</span><strong>${level} point(s)</strong>
              </div>
              <div class="bdnd-breakdown-row bdnd-spell-cost">
                <span>Stability Damage:</span>
                <strong>${baseSta} − ${stabReduction} = ${stabilityDmg}</strong>
              </div>
              ${reductionHTML}
            </div>
            <div class="dice-result">
              <h3 class="bdnd-result-success">RITUAL PERFORMED SUCCESSFULLY</h3>
              <div class="tn-label">Concoction rituals always succeed — the Loa have answered.</div>
              ${driveSpend > 0 ? `<p class="bdnd-rule-note" style="margin-top:4px;">Remember to deduct ${driveSpend} point(s) from the relevant pool for the Drive spend.</p>` : ''}
            </div>
          </div>
        `
      });

      if (newStability >= stabilityMax) {
        ui.notifications.warn(`${this.name} has reached maximum Stability Risk!`);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Refresh Event                                */
  /* -------------------------------------------- */

  async doRefreshEvent() {
    const confirmed = await DialogV2.confirm({
      window: { title: "Refresh Event" },
      content: `
        <p>This will restore <strong>all</strong> General Ability, Investigative Ability, and Approach pools to their Rating values.</p>
        <p><em>Stability Risk Counter is not affected — it can only be reduced via Reassurance.</em></p>
      `,
      rejectClose: false
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

    const confirmed = await DialogV2.confirm({
      window: { title: `Raise ${label}?` },
      content: `
        <form class="bdnd-dialog">
          <p>Spend <strong>1 Build Point</strong> to raise <strong>${label}</strong>
             from Rating ${currentRating} to Rating ${newRating}?</p>
          <p class="bdnd-rule-note">Build Points available: <strong>${bp}</strong></p>
        </form>
      `,
      rejectClose: false
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

  /* -------------------------------------------- */
  /*  Fleeing (p.21)                               */
  /* -------------------------------------------- */

  /**
   * Fleeing from an ongoing fight.
   * Athletics test; TN = 6 + number of foes being fled from.
   */
  async rollFleeing() {
    const dialogResult = await DialogV2.prompt({
      window: { title: 'Flee!' },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
      content: `
        <form class="bdnd-dialog">
          <p class="bdnd-rule-note">
            <strong>Fleeing (p.21):</strong> Make an Athletics test.<br>
            TN = 6 + the number of foes you are fleeing from.
          </p>
          <div class="form-group">
            <label>Number of foes fleeing from:</label>
            <input type="number" name="numFoes" value="1" min="1" max="10" autofocus/>
          </div>
        </form>
      `,
      ok: {
        label: 'Roll to Flee',
        icon: "fas fa-person-running",
        callback: (event, button) => ({ numFoes: parseInt(new FormDataExtended(button.form).object.numFoes) || 1 })
      },
      rejectClose: false
    });
    if (!dialogResult) return;

    const { numFoes } = dialogResult;
    await this.rollGeneralAbility('athletics', {
      title: `Flee! (${numFoes} foe${numFoes > 1 ? 's' : ''})`,
      tn:    6 + numFoes
    });
  }

  /* -------------------------------------------- */
  /*  Medicine (p.21)                              */
  /* -------------------------------------------- */

  /**
   * Spend Medicine pool points to reduce a character's Health Risk Counter.
   * Treating another: 1 pt → −3 Counter.
   * Self-treating:    1 pt → −1 Counter.
   * Target: the first targeted token (if any); otherwise self.
   */
  async useMedicine() {
    const medicine  = this.system.abilities?.general?.medicine;
    if (!medicine) return ui.notifications.error(`${this.name}: no Medicine ability found.`);
    const available = medicine.value ?? 0;
    if (available <= 0) return ui.notifications.warn(`${this.name} has no Medicine pool points remaining.`);

    // Determine target: first targeted token that isn't the healer; else self
    const targets  = [...(game.user?.targets ?? [])].filter(t => t.actor && t.actor.id !== this.id);
    const target   = targets.length > 0 ? targets[0].actor : this;
    const isSelf   = target.id === this.id;
    const ratio    = isSelf ? 1 : 3;
    const targetName = isSelf ? 'yourself' : target.name;

    const dialogResult = await DialogV2.prompt({
      window: { title: 'Use Medicine' },
      classes: ["bdnd-dialog"],
      position: { width: 380 },
      content: `
        <form class="bdnd-dialog">
          <p class="bdnd-rule-note">
            <strong>Medicine (p.21):</strong><br>
            ${isSelf
              ? 'Self-treating — 1 point spent reduces your Health Risk Counter by <strong>1</strong>.'
              : `Treating <strong>${target.name}</strong> — 1 point spent reduces their Health Risk Counter by <strong>3</strong>.`
            }
          </p>
          <div class="form-group">
            <label>Points to spend (pool: ${available}):</label>
            <input type="number" name="spend" value="1" min="1" max="${available}" autofocus/>
          </div>
        </form>
      `,
      ok: {
        label: 'Apply',
        icon: "fas fa-briefcase-medical",
        callback: (event, button) => ({ spend: parseInt(new FormDataExtended(button.form).object.spend) || 1 })
      },
      rejectClose: false
    });
    if (!dialogResult) return;

    const finalSpend = Math.min(dialogResult.spend, available);
    const reduction  = finalSpend * ratio;
    const currentHP  = target.system.health?.value ?? 0;
    const newHP      = Math.max(0, currentHP - reduction);

    await this.update({ 'system.abilities.general.medicine.value': Math.max(0, available - finalSpend) });
    await target.update({ 'system.health.value': newHP });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `
        <div class="bdnd-spend">
          <h3><i class="fas fa-briefcase-medical"></i> Medicine</h3>
          <div class="bdnd-breakdown-row"><span>Points Spent:</span><strong>${finalSpend}</strong></div>
          <div class="bdnd-breakdown-row"><span>Treating:</span><strong>${targetName} (×${ratio})</strong></div>
          <div class="bdnd-breakdown-row"><span>Health Risk Reduced:</span><strong>−${reduction}</strong></div>
          <p class="bdnd-rule-note"><em>${target.name}: Health Risk Counter ${currentHP} → ${newHP}</em></p>
        </div>
      `
    });
    ui.notifications.info(`${target.name}: Health Risk Counter reduced by ${reduction} (${currentHP} → ${newHP}).`);
  }

}
