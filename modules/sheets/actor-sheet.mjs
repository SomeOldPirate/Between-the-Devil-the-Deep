import { BDNDActor } from "../actor.mjs";

export class BDNDActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/bdnd/templates/actor/actor-sheet.hbs",
      classes: ["bdnd", "sheet", "actor"],
      width: 660,
      height: 820,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "general" }]
    });
  }

  async getData() {
    const context = super.getData();
    context.system = this.actor.system;

    // Persist show-all toggle in actor flags so it survives close/reopen
    context.showAllAbilities = await this.actor.getFlag("bdnd", "showAllAbilities") ?? false;

    // Precompute pip arrays — each pip is {full: bool}; done in JS to avoid HBS scope bugs
    context.approachList = Object.entries(context.system.approaches ?? {}).map(([key, approach]) => {
      const rating = approach.rating ?? 0;
      const pool   = approach.value  ?? 0;
      const pips   = [];
      for (let i = 0; i < rating; i++) pips.push({ full: i < pool });
      return { key, label: approach.label, rating, pool, pips };
    });

    const formatAbilityName = (key) =>
      key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // General abilities
    let generalList = [];
    for (const [key, ability] of Object.entries(context.system.abilities?.general ?? {})) {
      if (context.showAllAbilities || ability.rating > 0) {
        generalList.push({
          key,
          label: formatAbilityName(key),
          ...ability
        });
      }
    }
    context.generalAbilities = generalList.sort((a, b) => a.label.localeCompare(b.label));

    // Investigative abilities
    let investigativeList = [];
    for (const [key, ability] of Object.entries(context.system.abilities?.investigative ?? {})) {
      if (context.showAllAbilities || ability.rating > 0) {
        investigativeList.push({ key, label: formatAbilityName(key), ...ability });
      }
    }
    context.investigativeAbilities = investigativeList.sort((a, b) => a.label.localeCompare(b.label));

    // Item filtering
    context.loreSheets  = context.items.filter(i => i.type === 'lore_sheet');
    context.weapons     = context.items.filter(i => i.type === 'weapon');
    context.inventory   = context.items.filter(i => i.type === 'item');
    context.conditions  = context.items.filter(i => i.type === 'condition');
    context.armors      = context.items.filter(i => i.type === 'armor');
    context.spells      = context.items.filter(i => i.type === 'spell');
    context.driveItem   = context.items.find(i => i.type === 'drive');

    // Cherries — enrich with human-readable ability label for display
    context.cherries = context.items
      .filter(i => i.type === 'cherry')
      .map(i => ({
        ...i,
        system: {
          ...i.system,
          abilityLabel: i.system.ability
            ? i.system.ability.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : '—'
        }
      }))
      .sort((a, b) => a.system.abilityLabel.localeCompare(b.system.abilityLabel));

    // Option B: show spells section when NPC has spells, or Show All is toggled on
    context.showSpells = context.spells.length > 0 || context.showAllAbilities;

    // Condition counts for limit warnings (SHAMUS: max 2 physical + 2 mental)
    context.physicalConditions = context.conditions.filter(i => i.system.conditionType === 'physical').length;
    context.mentalConditions   = context.conditions.filter(i => i.system.conditionType === 'mental').length;

    context.totalBlock = context.armors.reduce(
      (sum, item) => sum + (item.system.equipped ? (Number(item.system.block) || 0) : 0), 0
    );

    // Progress bar percentages for risk counters (derived after prepareDerivedData runs)
    const hMax = context.system.health?.max    || context.system.health?.base    || 8;
    const sMax = context.system.stability?.max || context.system.stability?.base || 8;
    context.healthPct    = Math.min(100, Math.round(((context.system.health?.value    || 0) / hMax) * 100));
    context.stabilityPct = Math.min(100, Math.round(((context.system.stability?.value || 0) / sMax) * 100));

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Roll/spend buttons work even if sheet isn't fully editable (e.g. limited view)
    html.find('.roll-general').click(this._onRollGeneral.bind(this));
    html.find('.spend-investigative').click(this._onSpendInvestigative.bind(this));
    html.find('.spend-reassurance').click(() => this.actor.spendReassurance());
    html.find('.roll-clutch').click(() => this.actor.rollClutchTest());
    html.find('.roll-stability').click(() => this.actor.rollStabilityTest());
    html.find('.roll-contest').click(() => this.actor.rollContest());
    html.find('.roll-cooperation').click(() => this.actor.rollCooperation());
    html.find('.roll-weapon-attack').click(this._onRollWeaponAttack.bind(this));
    html.find('.roll-damage').click(this._onRollDamage.bind(this));
    html.find('.cast-spell').click(this._onCastSpell.bind(this));

    if (!this.isEditable) return;

    html.find('.toggle-abilities').click(this._onToggleAbilities.bind(this));
    html.find('.raise-rating').click(this._onRaiseRating.bind(this));
    html.find('.refresh-event').click(() => this.actor.doRefreshEvent());
    html.find('.item-create').click(this._onItemCreate.bind(this));
    html.find('.item-edit').click(this._onItemEdit.bind(this));
    html.find('.item-delete').click(this._onItemDelete.bind(this));
    html.find('.lore-toggle').click(this._onLoreToggle.bind(this));
    html.find('.lore-resolve').click(this._onLoreResolve.bind(this));
    html.find('.lore-refresh-all').click(this._onLoreRefresh.bind(this));
    html.find('.reload-weapon').click(this._onReloadWeapon.bind(this));
    html.find('.toggle-equip').click(this._onToggleEquip.bind(this));
  }

  async _onToggleAbilities(event) {
    event.preventDefault();
    const current = await this.actor.getFlag("bdnd", "showAllAbilities") ?? false;
    await this.actor.setFlag("bdnd", "showAllAbilities", !current);
    this.render();
  }

  _onRaiseRating(event) {
    event.preventDefault();
    const { type, key } = event.currentTarget.dataset;
    this.actor.raiseRating(type, key);
  }

  _onRollGeneral(event) {
    event.preventDefault();
    this.actor.rollGeneralAbility(event.currentTarget.dataset.key);
  }

  _onSpendInvestigative(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.key;
    // Reassurance has special targeting logic — delegate to its own method
    if (key === 'reassurance') return this.actor.spendReassurance();
    this.actor.spendInvestigativeAbility(key);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.type;
    return await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
  }

  _onItemEdit(event) {
    event.preventDefault();
    const el = $(event.currentTarget).closest('[data-item-id]');
    this.actor.items.get(el.data('itemId'))?.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const el = $(event.currentTarget).closest('[data-item-id]');
    const item = this.actor.items.get(el.data('itemId'));
    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Item",
      content: `<p>Delete <strong>${item.name}</strong>? This cannot be undone.</p>`
    });
    if (confirmed) item.delete();
  }

  async _onRollWeaponAttack(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    if (!item) return;

    // Check ammo before opening the roll dialog
    if (item.system.ammo?.max > 0) {
      if (item.system.ammo.value <= 0) {
        return ui.notifications.warn(`${item.name} is out of ammo!`);
      }
    }

    // Open the roll dialog first; only deduct ammo if the player commits
    await this.actor.rollGeneralAbility(item.system.ability || "weapons", {
      title: `Attack: ${item.name}`
    });

    // If we get here the dialog was confirmed (rollGeneralAbility resolves after
    // deducting pool), so now safely deduct ammo
    if (item.system.ammo?.max > 0 && item.system.ammo.value > 0) {
      await item.update({ "system.ammo.value": item.system.ammo.value - 1 });
    }
  }

  async _onReloadWeapon(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    if (item?.system.ammo?.max > 0) {
      await item.update({ "system.ammo.value": item.system.ammo.max });
      ui.notifications.info(`${item.name} reloaded.`);
    }
  }

  async _onToggleEquip(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    if (!item) return;
    await item.update({ "system.equipped": !item.system.equipped });
  }

  async _onRollDamage(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    const bonus = item?.system.bonus || 0;
    const roll = new Roll(`1d6 + ${bonus}`);
    await roll.evaluate();

    const dieResult = roll.terms[0]?.results?.[0]?.result ?? roll.total;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="bdnd-roll">
          <h2><i class="fas fa-dice-d6"></i> ${item?.name ?? 'Damage'}</h2>
          <div class="roll-details">
            <div class="bdnd-breakdown-row bdnd-info"><span>Weapon bonus:</span><em>+${bonus}</em></div>
          </div>
          <div class="dice-result">
            <h3>Damage: ${roll.total}</h3>
            <div class="tn-label">1d6 (${dieResult}) + ${bonus}</div>
          </div>
        </div>
      `,
      type: ChatMessage.TYPES.ROLL,
      rolls: [roll]
    });
  }

  async _onCastSpell(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    this.actor.castSpell(li.data("itemId"));
  }

  async _onLoreToggle(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    await item?.update({ "system.tapped": !item.system.tapped });
  }

  async _onLoreResolve(event) {
    event.preventDefault();
    const li = $(event.currentTarget).closest("[data-item-id]");
    const item = this.actor.items.get(li.data("itemId"));
    await item?.update({ "system.resolved": !item.system.resolved });
  }

  async _onLoreRefresh(event) {
    event.preventDefault();
    // Untap all lore sheets and restore Investigative ability pools to their ratings
    const confirmed = await Dialog.confirm({
      title: "Untap All Lore Sheets?",
      content: `<p>This will untap all Lore Sheets. Use the main <strong>Refresh</strong> button (General tab) to also restore ability pools.</p>`
    });
    if (!confirmed) return;

    const loreUpdates = this.actor.items
      .filter(i => i.type === "lore_sheet" && i.system.tapped)
      .map(i => ({ _id: i.id, "system.tapped": false }));
    if (loreUpdates.length) await this.actor.updateEmbeddedDocuments("Item", loreUpdates);

    ui.notifications.info("All Lore Sheets untapped.");
  }

  // Prevent dropping a second Drive item — replace the existing one
  async _onDropItemCreate(itemData) {
    if (itemData.type === "drive") {
      const existing = this.actor.items.find(i => i.type === "drive");
      if (existing) await existing.delete();
    }
    return super._onDropItemCreate(itemData);
  }
}

export class BDNDNPCSheet extends BDNDActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/bdnd/templates/actor/npc-sheet.hbs",
      classes: ["bdnd", "sheet", "npc"],
      width: 520,
      height: 680,
      tabs: []
    });
  }
}
