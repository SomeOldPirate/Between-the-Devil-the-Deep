/**
 * A single item sheet that shows a different field group depending on item.type.
 * @module bdnd/apps/item-sheet
 */

import BDND, { SYSTEM_ID } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * @extends {ItemSheetV2}
 */
export default class BDNDItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bdnd-item-{id}",
    classes: ["bdnd", "sheet", "item"],
    position: { width: 530, height: 480 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false }
  };

  /** @inheritdoc */
  static PARTS = {
    body: { template: `systems/${SYSTEM_ID}/templates/item/item-sheet.hbs`, root: true, scrollable: [""] }
  };

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      item: this.item,
      system: this.item.system,
      config: BDND,
      editable: this.isEditable,
      fields: this.item.system.schema.fields
    });
  }
}
