/**
 * Shared behavior for the "character" and "npc" Actor sheets: context
 * preparation (approaches ledger, ability lists, item buckets) and the
 * roll/item actions common to both. Each concrete sheet supplies its own
 * PARTS/TABS and template(s).
 * @module bdnd/apps/creature-sheet-base
 */

import BDND from "../config.mjs";

const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * @extends {ActorSheetV2}
 */
export default class BDNDCreatureSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /**
   * "Show all skills" is a viewing preference, not actor data, so it lives
   * here (per actor, for this browser session) rather than in a flag.
   * @type {Set<string>}
   */
  static #showAll = new Set();

  /** Advance mode shows the Spend-a-Build-Point arrows. */
  #advancing = false;

  /** Which counter's base max is being edited ("health" | "stability" | null). */
  #editingBase = null;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    classes: ["bdnd", "sheet", "actor"],
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollGeneral: BDNDCreatureSheet.#onRollGeneral,
      spendInvestigative: BDNDCreatureSheet.#onSpendInvestigative,
      rollClutch: BDNDCreatureSheet.#onRollClutch,
      rollStability: BDNDCreatureSheet.#onRollStability,
      rollFlee: BDNDCreatureSheet.#onRollFlee,
      useMedicine: BDNDCreatureSheet.#onUseMedicine,
      rollContest: BDNDCreatureSheet.#onRollContest,
      rollCooperation: BDNDCreatureSheet.#onRollCooperation,
      rollWeaponAttack: BDNDCreatureSheet.#onRollWeaponAttack,
      rollDamage: BDNDCreatureSheet.#onRollDamage,
      castSpell: BDNDCreatureSheet.#onCastSpell,
      toggleAbilities: BDNDCreatureSheet.#onToggleAbilities,
      toggleAdvance: BDNDCreatureSheet.#onToggleAdvance,
      editBase: BDNDCreatureSheet.#onEditBase,
      setPool: BDNDCreatureSheet.#onSetPool,
      raiseRating: BDNDCreatureSheet.#onRaiseRating,
      refreshEvent: BDNDCreatureSheet.#onRefreshEvent,
      itemCreate: BDNDCreatureSheet.#onItemCreate,
      itemEdit: BDNDCreatureSheet.#onItemEdit,
      itemDelete: BDNDCreatureSheet.#onItemDelete,
      loreToggle: BDNDCreatureSheet.#onLoreToggle,
      loreResolve: BDNDCreatureSheet.#onLoreResolve,
      loreRefreshAll: BDNDCreatureSheet.#onLoreRefreshAll,
      reloadWeapon: BDNDCreatureSheet.#onReloadWeapon,
      toggleEquip: BDNDCreatureSheet.#onToggleEquip
    }
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system;

    context.actor = actor;
    context.system = system;
    context.editable = this.isEditable;
    context.fields = system.schema.fields;

    const showAllAbilities = BDNDCreatureSheet.#showAll.has(actor.uuid);
    context.showAllAbilities = showAllAbilities;
    context.bp = system.build_points?.value ?? 0;
    context.advancing = this.#advancing && context.bp > 0;
    context.editingBase = this.#editingBase;

    // Precompute pip arrays and attach any Conditions on each Approach
    // (Conditions already apply a -1 penalty to rolls; this makes it visible on the sheet)
    const allConditions = actor.items.filter(i => i.type === "condition");
    context.approachList = Object.entries(system.approaches ?? {}).map(([key, approach]) => {
      const rating = approach.rating ?? 0;
      const pool   = approach.value  ?? 0;
      const pips   = [];
      for (let i = 0; i < rating; i++) pips.push({ full: i < pool, index: i });
      const conditionBadges = allConditions
        .filter(c => c.system.approach === key)
        .map(c => ({ name: c.name, type: c.system.conditionType }));
      return { key, label: approach.label, rating, pool, pips, conditionBadges };
    });

    const formatAbilityName = BDND.abilityLabel;

    // General abilities
    const generalList = [];
    for (const [key, ability] of Object.entries(system.abilities?.general ?? {})) {
      if (showAllAbilities || ability.rating > 0) {
        generalList.push({ key, label: formatAbilityName(key), ...ability });
      }
    }
    context.generalAbilities = generalList.sort((a, b) => a.label.localeCompare(b.label));

    // Investigative abilities
    const investigativeList = [];
    for (const [key, ability] of Object.entries(system.abilities?.investigative ?? {})) {
      if (showAllAbilities || ability.rating > 0) {
        investigativeList.push({ key, label: formatAbilityName(key), ...ability });
      }
    }
    context.investigativeAbilities = investigativeList.sort((a, b) => a.label.localeCompare(b.label));

    // Item filtering
    context.loreSheets = actor.items.filter(i => i.type === "lore_sheet");
    context.weapons    = actor.items.filter(i => i.type === "weapon");
    context.inventory  = actor.items.filter(i => i.type === "item");
    context.conditions = actor.items.filter(i => i.type === "condition");
    context.armors     = actor.items.filter(i => i.type === "armor");
    context.spells     = actor.items.filter(i => i.type === "spell");
    context.driveItem  = actor.items.find(i => i.type === "drive");

    // Cherries — enrich with human-readable ability label for display
    context.cherries = actor.items
      .filter(i => i.type === "cherry")
      .map(i => ({
        _id: i.id,
        name: i.name,
        system: {
          ...i.system,
          abilityLabel: BDND.abilityLabel(i.system.ability)
        }
      }))
      .sort((a, b) => a.system.abilityLabel.localeCompare(b.system.abilityLabel));

    // Option B: show spells section when NPC has spells, or Show All is toggled on
    context.showSpells = context.spells.length > 0 || showAllAbilities;

    // Condition counts for limit warnings (SHAMUS: max 2 physical + 2 mental)
    context.physicalConditions = context.conditions.filter(i => i.system.conditionType === "physical").length;
    context.mentalConditions   = context.conditions.filter(i => i.system.conditionType === "mental").length;

    context.totalBlock = context.armors.reduce(
      (sum, item) => sum + (item.system.equipped ? (Number(item.system.block) || 0) : 0), 0
    );

    // Progress bar percentages for risk counters (derived after prepareDerivedData runs)
    const hMax = system.health?.max    || system.health?.base    || 8;
    const sMax = system.stability?.max || system.stability?.base || 8;
    context.healthPct    = Math.min(100, Math.round(((system.health?.value    || 0) / hMax) * 100));
    context.stabilityPct = Math.min(100, Math.round(((system.stability?.value || 0) / sMax) * 100));

    return context;
  }

  /** Close the base-max editor once a new value is entered. */
  _onChangeForm(formConfig, event) {
    if (event.target?.classList?.contains("counter-base-input")) this.#editingBase = null;
    return super._onChangeForm(formConfig, event);
  }

  /** Focus the base-max input when it opens; close it again on blur. */
  async _onRender(context, options) {
    await super._onRender(context, options);
    const input = this.element.querySelector(".counter-base-input");
    if (!input) return;
    input.focus();
    input.select();
    input.addEventListener("blur", () => {
      this.#editingBase = null;
      // Let the change (if any) submit first
      setTimeout(() => this.render(), 50);
    }, { once: true });
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _onDropItem(event, item) {
    // Prevent dropping a second Drive item — replace the existing one
    if (item.type === "drive" && item.parent?.uuid !== this.actor.uuid) {
      const existing = this.actor.items.find(i => i.type === "drive");
      if (existing) await existing.delete();
    }
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Actions — always active (roll/spend)        */
  /* -------------------------------------------- */

  static #onRollClutch() {
    this.actor.rollClutchTest();
  }

  static #onRollStability() {
    this.actor.rollStabilityTest();
  }

  static #onRollFlee() {
    this.actor.rollFleeing();
  }

  static #onUseMedicine() {
    this.actor.useMedicine();
  }

  static #onRollContest() {
    this.actor.rollContest();
  }

  static #onRollCooperation() {
    this.actor.rollCooperation();
  }

  static #onRollGeneral(event, target) {
    this.actor.rollGeneralAbility(target.dataset.key);
  }

  static #onSpendInvestigative(event, target) {
    const key = target.dataset.key;
    // Reassurance has special targeting logic — delegate to its own method
    if (key === "reassurance") return this.actor.spendReassurance();
    this.actor.spendInvestigativeAbility(key);
  }

  static async #onRollWeaponAttack(event, target) {
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;

    // Check ammo before opening the roll dialog
    if (item.system.ammo?.max > 0 && item.system.ammo.value <= 0) {
      return ui.notifications.warn(`${item.name} is out of ammo!`);
    }

    // Open the roll dialog first; only deduct ammo if the player actually rolls
    // (rollGeneralAbility returns the Roll, or null if the dialog was cancelled)
    const roll = await this.actor.rollGeneralAbility(item.system.ability || "weapons", {
      title: `Attack: ${item.name}`,
      weapon: item
    });
    if (!roll) return;

    if (item.system.ammo?.max > 0 && item.system.ammo.value > 0) {
      await item.update({ "system.ammo.value": item.system.ammo.value - 1 });
    }
  }

  static async #onRollDamage(event, target) {
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    const bonus = item?.system.bonus || 0;
    const roll = new Roll(`1d6 + ${bonus}`);
    await roll.evaluate();

    const dieResult = roll.terms[0]?.results?.[0]?.result ?? roll.total;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="bdnd-roll">
          <h2><i class="fas fa-dice-d6"></i> ${item?.name ?? "Damage"}</h2>
          <div class="roll-details">
            <div class="bdnd-breakdown-row bdnd-info"><span>Weapon bonus:</span><em>+${bonus}</em></div>
          </div>
          <div class="dice-result">
            <h3>Damage: ${roll.total}</h3>
            <div class="tn-label">1d6 (${dieResult}) + ${bonus}</div>
          </div>
        </div>
      `,
      rolls: [roll]
    });
  }

  static #onCastSpell(event, target) {
    const li = target.closest("[data-item-id]");
    this.actor.castSpell(li?.dataset.itemId);
  }

  /* -------------------------------------------- */
  /*  Actions — editable only                     */
  /* -------------------------------------------- */

  static #onToggleAbilities() {
    const set = BDNDCreatureSheet.#showAll;
    const uuid = this.actor.uuid;
    if (set.has(uuid)) set.delete(uuid); else set.add(uuid);
    this.render();
  }

  static #onToggleAdvance() {
    this.#advancing = !this.#advancing;
    this.render();
  }

  static #onEditBase(event, target) {
    if (!this.isEditable) return;
    this.#editingBase = target.dataset.counter;
    this.render();
  }

  /** Click a pip to set the pool to that many points; click the last full pip to empty it. */
  static async #onSetPool(event, target) {
    if (!this.isEditable) return;
    const { key } = target.dataset;
    const index = Number(target.dataset.index);
    const current = this.actor.system.approaches[key]?.value ?? 0;
    const value = current === index + 1 ? index : index + 1;
    await this.actor.update({ [`system.approaches.${key}.value`]: value });
  }

  static #onRaiseRating(event, target) {
    if (!this.isEditable) return;
    const { type, key } = target.dataset;
    this.actor.raiseRating(type, key);
  }

  static #onRefreshEvent() {
    if (!this.isEditable) return;
    this.actor.doRefreshEvent();
  }

  static async #onItemCreate(event, target) {
    if (!this.isEditable) return;
    const type = target.dataset.type;
    await Item.create({ name: `New ${type.capitalize()}`, type }, { parent: this.actor });
  }

  static #onItemEdit(event, target) {
    const li = target.closest("[data-item-id]");
    this.actor.items.get(li?.dataset.itemId)?.sheet.render(true);
  }

  static async #onItemDelete(event, target) {
    if (!this.isEditable) return;
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: "Delete Item" },
      content: `<p>Delete <strong>${item.name}</strong>? This cannot be undone.</p>`,
      rejectClose: false
    });
    if (confirmed) item.delete();
  }

  static async #onReloadWeapon(event, target) {
    if (!this.isEditable) return;
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (item?.system.ammo?.max > 0) {
      await item.update({ "system.ammo.value": item.system.ammo.max });
      ui.notifications.info(`${item.name} reloaded.`);
    }
  }

  static async #onToggleEquip(event, target) {
    if (!this.isEditable) return;
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    if (!item) return;
    await item.update({ "system.equipped": !item.system.equipped });
  }

  static async #onLoreToggle(event, target) {
    if (!this.isEditable) return;
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    await item?.update({ "system.tapped": !item.system.tapped });
  }

  static async #onLoreResolve(event, target) {
    if (!this.isEditable) return;
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li?.dataset.itemId);
    await item?.update({ "system.resolved": !item.system.resolved });
  }

  static async #onLoreRefreshAll() {
    if (!this.isEditable) return;
    const loreUpdates = this.actor.items
      .filter(i => i.type === "lore_sheet" && i.system.tapped)
      .map(i => ({ _id: i.id, "system.tapped": false }));
    if (loreUpdates.length) await this.actor.updateEmbeddedDocuments("Item", loreUpdates);

    ui.notifications.info("All Lore Sheets untapped.");
  }
}
