/**
 * BD&D — Counter Board Sheet
 *
 * Tracks Risk and Progress Counters per the SHAMUS rules (pp. 23–25).
 * Create one or more Counter Board actors in your world; each holds an
 * arbitrary set of named counters (stored as JSON in system.counters_json).
 *
 * Supported operations per counter:
 *  −1 / +1     Manual step (for GM bookkeeping)
 *  +1d6        Counter Roll — GM trigger or failed PC test raises the counter
 *  −1d6        PC Reduction — successful PC action lowers the counter
 *  Delete      Remove the counter from the board
 *
 * Stepping a counter to its maximum by ±1 posts a chat alert; a 1d6 roll's
 * own chat card already marks MAX.
 * @module bdnd/apps/counter-board-sheet
 */

import { SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * @extends {ActorSheetV2}
 */
export default class BDNDCounterBoardSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bdnd-counter-board-{id}",
    classes: ["bdnd", "sheet", "counter-board"],
    position: { width: 540, height: 620 },
    window: { resizable: true, icon: "fa-solid fa-chart-bar" },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      ctrIncrement: BDNDCounterBoardSheet.#onIncrement,
      ctrDecrement: BDNDCounterBoardSheet.#onDecrement,
      ctrRollAdd: BDNDCounterBoardSheet.#onRollAdd,
      ctrRollReduce: BDNDCounterBoardSheet.#onRollReduce,
      ctrDelete: BDNDCounterBoardSheet.#onDelete,
      ctrAddNew: BDNDCounterBoardSheet.#onAddNew
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/actor/counter-board-sheet.hbs`, root: true, scrollable: [""] }
  };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    context.actor = actor;
    context.system = actor.system;
    context.editable = this.isEditable;
    context.fields = actor.system.schema.fields;

    // Parse stored JSON; fall back to empty array on any parse error
    let raw = [];
    try { raw = JSON.parse(actor.system.counters_json || "[]"); }
    catch (_) { raw = []; }

    // Enrich each counter with display-ready values
    context.counters = raw.map(c => {
      const pct    = c.max > 0 ? Math.min(100, Math.round((c.current / c.max) * 100)) : 0;
      const danger = pct >= 75 ? "danger" : pct >= 50 ? "warning" : "safe";
      return { ...c, pct, danger, atMax: c.current >= c.max };
    });

    return context;
  }

  /* -------------------------------------------- */
  /*  Form submission — inline name/max/type edits */
  /* -------------------------------------------- */

  /**
   * Inline counter edits (name/max/type) use `data-id` rather than a
   * `name="system.*"` path, since each counter is one entry in a JSON blob
   * rather than its own schema field — so they're intercepted here instead
   * of flowing through the generic document-update submit handler.
   * @inheritdoc
   */
  _onChangeForm(formConfig, event) {
    const input = event.target;
    const id = input?.dataset?.id;
    if (!id) return super._onChangeForm(formConfig, event);

    const counters = this.#getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;

    if (input.classList.contains("ctr-name-input")) c.name = input.value;
    else if (input.classList.contains("ctr-max-input")) c.max = Math.max(1, parseInt(input.value) || 20);
    else if (input.classList.contains("ctr-type-select")) c.type = input.value;
    else return super._onChangeForm(formConfig, event);

    this.#saveCounters(counters);
  }

  /* -------------------------------------------- */
  /*  Private helpers                             */
  /* -------------------------------------------- */

  #getCounters() {
    try { return JSON.parse(this.actor.system.counters_json || "[]"); }
    catch (_) { return []; }
  }

  async #saveCounters(counters) {
    return this.actor.update({ "system.counters_json": JSON.stringify(counters) });
  }

  async #step(id, delta) {
    const counters = this.#getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;
    const wasAtMax = c.current >= c.max;
    c.current = Math.max(0, Math.min(c.max, c.current + delta));
    await this.#saveCounters(counters);
    if (!wasAtMax && c.current >= c.max) await this.#postMaxAlert(c);
  }

  async #rollStep(id, direction) {
    const counters = this.#getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;

    const roll = new Roll("1d6");
    await roll.evaluate();
    const die = roll.terms[0]?.results?.[0]?.result ?? roll.total;
    const wasAtMax = c.current >= c.max;
    const prev = c.current;
    c.current = Math.max(0, Math.min(c.max, c.current + direction * roll.total));
    await this.#saveCounters(counters);

    const verb   = direction > 0 ? "increases" : "decreases";
    const delta  = direction > 0 ? `+${roll.total}` : `−${roll.total}`;
    const icon   = direction > 0 ? "fa-arrow-trend-up" : "fa-arrow-trend-down";
    const hitMax = !wasAtMax && c.current >= c.max;

    await ChatMessage.create({
      speaker: { alias: this.actor.name },
      rolls: [roll],
      content: `
        <div class="bdnd-spend">
          <h3><i class="fas fa-chart-bar"></i> ${c.name}
              <span class="ctr-type-badge ctr-type-${c.type}">${c.type === "risk" ? "Risk" : "Progress"}</span>
          </h3>
          <p><i class="fas ${icon}"></i> Counter ${verb} by <strong>${delta}</strong>
             <span class="tn-label">(1d6 [${die}])</span></p>
          <p class="bdnd-breakdown-row">
            <span>Counter:</span>
            <strong>${prev} → ${c.current} / ${c.max}</strong>
            ${hitMax ? '<span class="bdnd-result-failure"> ⚠ MAX</span>' : ""}
          </p>
        </div>
      `
    });
  }

  async #deleteCounter(id) {
    const counters = this.#getCounters();
    if (!counters.some(x => x.id === id)) return;
    await this.#saveCounters(counters.filter(x => x.id !== id));
  }

  async #addCounter() {
    const counters = this.#getCounters();
    counters.push({
      id: foundry.utils.randomID(),
      name: "New Counter",
      type: "risk",
      current: 0,
      max: 20
    });
    await this.#saveCounters(counters);
  }

  async #postMaxAlert(c) {
    const msg = c.type === "risk"
      ? "Trigger the consequence described for this Risk Counter's maximum level."
      : "Progress goal reached — resolve the outcome of this Progress Counter.";
    await ChatMessage.create({
      speaker: { alias: this.actor.name },
      content: `
        <div class="bdnd-spend">
          <h3 style="color:#8b0000;"><i class="fas fa-triangle-exclamation"></i> Counter Maxed Out</h3>
          <p><strong>${c.name}</strong> has reached its maximum (${c.max}).</p>
          <p class="bdnd-rule-note">${msg}</p>
        </div>
      `
    });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onIncrement(event, target) {
    if (!this.isEditable) return;
    this.#step(target.dataset.id, 1);
  }

  static #onDecrement(event, target) {
    if (!this.isEditable) return;
    this.#step(target.dataset.id, -1);
  }

  static #onRollAdd(event, target) {
    if (!this.isEditable) return;
    this.#rollStep(target.dataset.id, 1);
  }

  static #onRollReduce(event, target) {
    if (!this.isEditable) return;
    this.#rollStep(target.dataset.id, -1);
  }

  static #onDelete(event, target) {
    if (!this.isEditable) return;
    this.#deleteCounter(target.dataset.id);
  }

  static #onAddNew(event, target) {
    if (!this.isEditable) return;
    this.#addCounter();
  }
}
