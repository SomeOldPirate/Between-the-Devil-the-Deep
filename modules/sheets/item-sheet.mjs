export class BDNDItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 530,
      height: 480, // Increased height to accommodate the textarea
      classes: ["bdnd", "sheet", "item"]
    });
  }

  get template() {
    return `systems/bdnd/templates/item/item-sheet.hbs`;
  }

  getData() {
    const context = super.getData();
    // Ensure the system object is available at the root for Handlebars paths
    context.system = this.item.system;
    return context;
  }
}