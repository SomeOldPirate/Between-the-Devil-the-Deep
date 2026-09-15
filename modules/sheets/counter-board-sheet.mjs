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
 * When a counter reaches its maximum a chat alert is posted automatically.
 */
export class BDNDCounterBoardSheet extends ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template:  'systems/bdnd/templates/actor/counter-board-sheet.hbs',
      classes:   ['bdnd', 'sheet', 'counter-board'],
      width:     540,
      height:    620,
      resizable: true
    });
  }

  /* ── getData ──────────────────────────────────────────────────────────── */

  async getData() {
    const context = super.getData();
    context.system = this.actor.system;

    // Parse stored JSON; fall back to empty array on any parse error
    let raw = [];
    try { raw = JSON.parse(this.actor.system.counters_json || '[]'); }
    catch (_) { raw = []; }

    // Enrich each counter with display-ready values
    context.counters = raw.map(c => {
      const pct    = c.max > 0 ? Math.min(100, Math.round((c.current / c.max) * 100)) : 0;
      const danger = pct >= 75 ? 'danger' : pct >= 50 ? 'warning' : 'safe';
      return { ...c, pct, danger, atMax: c.current >= c.max };
    });

    return context;
  }

  /* ── activateListeners ────────────────────────────────────────────────── */

  activateListeners(html) {
    super.activateListeners(html);

    // Step buttons
    html.find('.ctr-increment').click(async ev => {
      ev.preventDefault();
      await this._step(ev.currentTarget.dataset.id, 1);
    });
    html.find('.ctr-decrement').click(async ev => {
      ev.preventDefault();
      await this._step(ev.currentTarget.dataset.id, -1);
    });

    // Dice-roll buttons
    html.find('.ctr-roll-add').click(async ev => {
      ev.preventDefault();
      await this._rollStep(ev.currentTarget.dataset.id, 1);
    });
    html.find('.ctr-roll-reduce').click(async ev => {
      ev.preventDefault();
      await this._rollStep(ev.currentTarget.dataset.id, -1);
    });

    // Delete
    html.find('.ctr-delete').click(async ev => {
      ev.preventDefault();
      await this._deleteCounter(ev.currentTarget.dataset.id);
    });

    // Add new
    html.find('.ctr-add-new').click(async ev => {
      ev.preventDefault();
      await this._addCounter();
    });

    if (!this.isEditable) return;

    // Inline edits (name, max, type)
    html.find('.ctr-name-input').change(async ev => {
      const counters = this._getCounters();
      const c = counters.find(x => x.id === ev.currentTarget.dataset.id);
      if (c) { c.name = ev.currentTarget.value; await this._saveCounters(counters); }
    });
    html.find('.ctr-max-input').change(async ev => {
      const counters = this._getCounters();
      const c = counters.find(x => x.id === ev.currentTarget.dataset.id);
      if (c) { c.max = Math.max(1, parseInt(ev.currentTarget.value) || 20); await this._saveCounters(counters); }
    });
    html.find('.ctr-type-select').change(async ev => {
      const counters = this._getCounters();
      const c = counters.find(x => x.id === ev.currentTarget.dataset.id);
      if (c) { c.type = ev.currentTarget.value; await this._saveCounters(counters); }
    });
  }

  /* ── Private helpers ──────────────────────────────────────────────────── */

  _getCounters() {
    try { return JSON.parse(this.actor.system.counters_json || '[]'); }
    catch (_) { return []; }
  }

  async _saveCounters(counters) {
    return this.actor.update({ 'system.counters_json': JSON.stringify(counters) });
  }

  async _step(id, delta) {
    const counters = this._getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;
    const wasAtMax = c.current >= c.max;
    c.current = Math.max(0, Math.min(c.max, c.current + delta));
    await this._saveCounters(counters);
    if (!wasAtMax && c.current >= c.max) await this._postMaxAlert(c);
  }

  async _rollStep(id, direction) {
    const counters = this._getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;

    const roll    = new Roll('1d6');
    await roll.evaluate();
    const die     = roll.terms[0]?.results?.[0]?.result ?? roll.total;
    const wasAtMax = c.current >= c.max;
    const prev    = c.current;
    c.current = Math.max(0, Math.min(c.max, c.current + direction * roll.total));
    await this._saveCounters(counters);

    const verb    = direction > 0 ? 'increases' : 'decreases';
    const delta   = direction > 0 ? `+${roll.total}` : `−${roll.total}`;
    const icon    = direction > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    const hitMax  = !wasAtMax && c.current >= c.max;

    await ChatMessage.create({
      speaker: { alias: this.actor.name },
      rolls:   [roll],
      content: `
        <div class="bdnd-spend">
          <h3><i class="fas fa-chart-bar"></i> ${c.name}
              <span class="ctr-type-badge ctr-type-${c.type}">${c.type === 'risk' ? 'Risk' : 'Progress'}</span>
          </h3>
          <p><i class="fas ${icon}"></i> Counter ${verb} by <strong>${delta}</strong>
             <span class="tn-label">(1d6 [${die}])</span></p>
          <p class="bdnd-breakdown-row">
            <span>Counter:</span>
            <strong>${prev} → ${c.current} / ${c.max}</strong>
            ${hitMax ? '<span class="bdnd-result-failure"> ⚠ MAX</span>' : ''}
          </p>
        </div>
      `,
      type: CONST.CHAT_MESSAGE_TYPES?.ROLL ?? 5
    });

    if (hitMax) await this._postMaxAlert(c);
  }

  async _deleteCounter(id) {
    const counters = this._getCounters();
    const c = counters.find(x => x.id === id);
    if (!c) return;
    const ok = await Dialog.confirm({
      title:   'Remove Counter',
      content: `<p>Remove <strong>${c.name}</strong> from this board?</p>`
    });
    if (!ok) return;
    await this._saveCounters(counters.filter(x => x.id !== id));
  }

  async _addCounter() {
    const counters = this._getCounters();
    counters.push({
      id:      foundry.utils.randomID(),
      name:    'New Counter',
      type:    'risk',
      current: 0,
      max:     20
    });
    await this._saveCounters(counters);
  }

  async _postMaxAlert(c) {
    const msg = c.type === 'risk'
      ? 'Trigger the consequence described for this Risk Counter\'s maximum level.'
      : 'Progress goal reached — resolve the outcome of this Progress Counter.';
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
}
