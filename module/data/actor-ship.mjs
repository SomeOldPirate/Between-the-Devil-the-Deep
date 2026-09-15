/**
 * Data model for the "ship" Actor type.
 * @module bdnd/data/actor-ship
 */

import { BDNDTypeDataModel, fields, int, str } from "./base.mjs";

/**
 * A pirate vessel, tracked via the SHAMUS Risk/Progress Counter system.
 * @extends {BDNDTypeDataModel}
 */
export default class ShipData extends BDNDTypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      captain: str(),
      class: str(),
      biography: str(),

      // Stored as free text in the original system (e.g. "50 crates") rather
      // than numeric, so the field types are preserved as strings here too.
      cargo: new fields.SchemaField({
        current: str(),
        max: str()
      }),

      sails: new fields.SchemaField({
        rating: int({ initial: 0 }),
        min: int({ initial: 0 }),
        current: int({ initial: 0 })
      }),

      hands: new fields.SchemaField({
        skeleton: int({ initial: 0 }),
        full: int({ initial: 0 }),
        battle: int({ initial: 0 }),
        current: int({ initial: 0 })
      }),

      cannons: new fields.SchemaField({
        current: int({ initial: 0 }),
        max: int({ initial: 0 })
      }),

      provisions: new fields.SchemaField({
        value: int({ initial: 0 }),
        max: int({ initial: 0 })
      }),

      armor: int({ initial: 0 }),

      counters: new fields.SchemaField({
        maneuver: new fields.SchemaField({ value: int({ initial: 0 }), max: int({ initial: 36 }) }),
        ship_shape: new fields.SchemaField({ value: int({ initial: 0 }), max: int({ initial: 50 }) }),
        boarding: new fields.SchemaField({ value: int({ initial: 0 }), max: int({ initial: 20 }) })
      }),

      booty: new fields.SchemaField({ value: int({ initial: 0 }) }),
      modifications: str()
    };
  }
}
