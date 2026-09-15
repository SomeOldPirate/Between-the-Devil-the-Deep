/**
 * Shared DataModel scaffolding for Between the Devil & the Deep.
 * @module bdnd/data/base
 */

const fields = foundry.data.fields;

/**
 * A required integer field.
 * @param {object} [options]
 * @param {number} [options.initial=0]
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @returns {foundry.data.fields.NumberField}
 */
export function int({ initial = 0, min, max } = {}) {
  const cfg = { required: true, integer: true, initial };
  if (min !== undefined) cfg.min = min;
  if (max !== undefined) cfg.max = max;
  return new fields.NumberField(cfg);
}

/**
 * A plain (non-blank-required) string field.
 * @param {string} [initial=""]
 * @returns {foundry.data.fields.StringField}
 */
export function str(initial = "") {
  return new fields.StringField({ required: true, blank: true, initial });
}

/**
 * A required string constrained to a fixed set of choices.
 * @param {Record<string, string>} choices
 * @param {string} initial
 * @returns {foundry.data.fields.StringField}
 */
export function choice(choices, initial) {
  return new fields.StringField({ required: true, blank: false, initial, choices });
}

/**
 * A required boolean field.
 * @param {boolean} [initial=false]
 * @returns {foundry.data.fields.BooleanField}
 */
export function bool(initial = false) {
  return new fields.BooleanField({ required: true, initial });
}

/**
 * Recursively coerce NumberField slots holding blank/non-numeric legacy
 * values (e.g. "" from an old, unvalidated text-like input, or a value
 * left over from a since-removed field) to that field's own initial value,
 * so a single bad stray value can't hard-fail schema validation and make
 * the whole actor "unavailable" on load. Runs in migrateData, before
 * validation.
 * @param {foundry.data.fields.SchemaField} schemaField
 * @param {object} data
 */
function sanitizeNumberFields(schemaField, data) {
  if (!data || typeof data !== "object") return;
  for (const [key, field] of Object.entries(schemaField.fields)) {
    if (field instanceof foundry.data.fields.SchemaField) {
      sanitizeNumberFields(field, data[key]);
    } else if (field instanceof foundry.data.fields.NumberField) {
      if (!(key in data)) continue;
      const value = data[key];
      if (typeof value === "number" && Number.isFinite(value)) continue;
      const coerced = Number(value);
      data[key] = Number.isFinite(coerced) ? coerced : (field.initial ?? 0);
    }
  }
}

/**
 * Common base for all Between the Devil & the Deep type data models.
 * @abstract
 * @extends {foundry.abstract.TypeDataModel}
 */
export class BDNDTypeDataModel extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static migrateData(source) {
    sanitizeNumberFields(this.schema, source);
    return super.migrateData(source);
  }
}

export { fields };
