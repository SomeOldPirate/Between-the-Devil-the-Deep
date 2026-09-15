/**
 * The NPC sheet — a single-page (non-tabbed) sheet for foes and crew.
 * @module bdnd/apps/npc-sheet
 */

import { SYSTEM_ID } from "../config.mjs";
import BDNDCreatureSheet from "./creature-sheet-base.mjs";

/**
 * @extends {BDNDCreatureSheet}
 */
export default class BDNDNpcSheet extends BDNDCreatureSheet {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bdnd-npc-{id}",
    position: { width: 520, height: 680 },
    window: { icon: "fa-solid fa-skull-crossbones" },
    actions: {
      toggleNpcType: BDNDNpcSheet.#onToggleNpcType
    }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/actor/npc-sheet.hbs`, root: true, scrollable: [""] }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Named NPCs have full Conditions; Regular NPCs are Taken Out at max counter (no Conditions)
    context.npcType      = this.actor.getFlag(SYSTEM_ID, "npcType") ?? "named";
    context.isRegularNPC = context.npcType === "regular";
    return context;
  }

  static async #onToggleNpcType() {
    if (!this.isEditable) return;
    const current = this.actor.getFlag(SYSTEM_ID, "npcType") ?? "named";
    await this.actor.setFlag(SYSTEM_ID, "npcType", current === "named" ? "regular" : "named");
  }
}
