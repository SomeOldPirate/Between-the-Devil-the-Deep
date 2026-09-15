/**
 * Shared data model plumbing for the "character" and "npc" Actor types.
 * @module bdnd/data/actor-creature
 */

import BDND from "../config.mjs";
import { BDNDTypeDataModel, fields, int, str } from "./base.mjs";

/**
 * Build the Approaches schema (Forceful, Slick, Flashy, Agile, Focused, Deceptive).
 * @returns {Record<string, foundry.data.fields.SchemaField>}
 */
function approachesSchema() {
  const approaches = {};
  for (const key of BDND.approachOrder) {
    approaches[key] = new fields.SchemaField({
      value: int({ initial: 0 }),
      rating: int({ initial: 0 }),
      label: str(BDND.approaches[key])
    });
  }
  return approaches;
}

/**
 * Build a General or Investigative Ability schema from a list of keys.
 * @param {string[]} keys
 * @returns {Record<string, foundry.data.fields.SchemaField>}
 */
function abilitiesSchema(keys) {
  const abilities = {};
  for (const key of keys) {
    abilities[key] = new fields.SchemaField({
      value: int({ initial: 0 }),
      rating: int({ initial: 0 })
    });
  }
  return abilities;
}

/**
 * The schema shared by both crewmember Actor types: a captain (character) or an NPC.
 * @returns {object}
 */
function creatureSchema() {
  return {
    biography: str(),
    health: new fields.SchemaField({
      value: int({ initial: 0 }),
      base: int({ initial: 10 }),
      max: int({ initial: 10 }),
      label: str("Health Risk")
    }),
    stability: new fields.SchemaField({
      value: int({ initial: 0 }),
      base: int({ initial: 10 }),
      max: int({ initial: 10 }),
      label: str("Stability Risk")
    }),
    booty: new fields.SchemaField({ value: int({ initial: 0 }) }),
    coin: new fields.SchemaField({ value: int({ initial: 0 }) }),
    approaches: new fields.SchemaField(approachesSchema()),
    abilities: new fields.SchemaField({
      general: new fields.SchemaField(abilitiesSchema(BDND.generalAbilities)),
      investigative: new fields.SchemaField(abilitiesSchema(BDND.investigativeAbilities))
    })
  };
}

/**
 * A player captain — the "character" Actor type.
 * @extends {BDNDTypeDataModel}
 */
export class CharacterData extends BDNDTypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...creatureSchema(),
      build_points: new fields.SchemaField({ value: int({ initial: 0 }) })
    };
  }
}

/**
 * A non-player crewmember or foe — the "npc" Actor type.
 * @extends {BDNDTypeDataModel}
 */
export class NpcData extends BDNDTypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      ...creatureSchema(),
      // Free-text motivation/instinct field, distinct from the character
      // type's embedded Drive item — NPCs don't get one of those.
      drive: str()
    };
  }
}
