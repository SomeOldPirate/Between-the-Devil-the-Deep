/**
 * The player captain sheet.
 * @module bdnd/apps/character-sheet
 */

import { SYSTEM_ID } from "../config.mjs";
import BDNDCreatureSheet from "./creature-sheet-base.mjs";

/**
 * @extends {BDNDCreatureSheet}
 */
export default class BDNDCharacterSheet extends BDNDCreatureSheet {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bdnd-character-{id}",
    classes: ["captain-sheet"],
    position: { width: 660, height: 820 },
    window: { icon: "fa-solid fa-hat-cowboy" }
  };

  /** @inheritdoc */
  static PARTS = {
    header: { template: `systems/${SYSTEM_ID}/templates/actor/character-header.hbs` },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    general: { template: `systems/${SYSTEM_ID}/templates/actor/character-general.hbs`, scrollable: [""] },
    investigative: { template: `systems/${SYSTEM_ID}/templates/actor/character-investigative.hbs`, scrollable: [""] },
    inventory: { template: `systems/${SYSTEM_ID}/templates/actor/character-inventory.hbs`, scrollable: [""] },
    notes: { template: `systems/${SYSTEM_ID}/templates/actor/character-notes.hbs`, scrollable: [""] }
  };

  /** @inheritdoc */
  static TABS = {
    primary: {
      tabs: [
        { id: "general", label: "General" },
        { id: "investigative", label: "Investigative" },
        { id: "inventory", label: "Inventory" },
        { id: "notes", label: "Log" }
      ],
      initial: "general"
    }
  };

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.tabs ??= this._prepareTabs?.("primary") ?? {};
    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }
}
