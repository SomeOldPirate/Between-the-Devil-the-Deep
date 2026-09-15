/**
 * Data models for all Item types.
 * @module bdnd/data/items
 */

import { BDNDTypeDataModel, fields, int, str, bool } from "./base.mjs";

/** A plain sundry item — the "item" type. */
export class ItemData extends BDNDTypeDataModel {
  static defineSchema() {
    return { description: str() };
  }
}

/** A Lore Sheet — the "lore_sheet" type. */
export class LoreSheetData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      tapped: bool(false),
      resolved: bool(false),
      description: str()
    };
  }
}

/** A weapon — the "weapon" type. */
export class WeaponData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      bonus: int({ initial: 0 }),
      range: str("Close"),
      notes: str(),
      equipped: bool(true),
      ability: str("weapons"),
      ammo: new fields.SchemaField({
        value: int({ initial: 0 }),
        max: int({ initial: 0 })
      })
    };
  }
}

/** A suit or piece of armor — the "armor" type. */
export class ArmorData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      block: int({ initial: 0 }),
      equipped: bool(true),
      description: str()
    };
  }
}

/** A Condition — the "condition" type. */
export class ConditionData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      approach: str("forceful"),
      conditionType: str("physical"),
      description: str()
    };
  }
}

/** A spell or ritual — the "spell" type. */
export class SpellData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      level: int({ initial: 1, min: 1, max: 3 }),
      spell_type: str("casting"),
      target_tn: int({ initial: 8 }),
      description: str()
    };
  }
}

/** A character's Drive — the "drive" type. */
export class DriveData extends BDNDTypeDataModel {
  static defineSchema() {
    return { description: str() };
  }
}

/** A Cherry (ability specialization perk) — the "cherry" type. */
export class CherryData extends BDNDTypeDataModel {
  static defineSchema() {
    return {
      ability: str("athletics"),
      cherry_name: str(),
      effect_type: str("special"),
      health_max_bonus: int({ initial: 0 }),
      stability_max_bonus: int({ initial: 0 }),
      has_post_roll_spend: bool(false),
      description: str()
    };
  }
}

/** @type {Record<string, typeof BDNDTypeDataModel>} */
export const itemDataModels = {
  item: ItemData,
  lore_sheet: LoreSheetData,
  weapon: WeaponData,
  armor: ArmorData,
  condition: ConditionData,
  spell: SpellData,
  drive: DriveData,
  cherry: CherryData
};
