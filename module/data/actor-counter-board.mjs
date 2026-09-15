/**
 * Data model for the "counter_board" Actor type.
 * @module bdnd/data/actor-counter-board
 */

import { BDNDTypeDataModel, str } from "./base.mjs";

/**
 * A free-form board of Risk/Progress Counters (SHAMUS pp. 23-25). The counters
 * themselves are stored as a JSON blob rather than a strict schema, since the
 * GM can add or remove an arbitrary number of them at any time.
 * @extends {BDNDTypeDataModel}
 */
export default class CounterBoardData extends BDNDTypeDataModel {
  /** @inheritdoc */
  static defineSchema() {
    return {
      counters_json: str("[]"),
      notes: str()
    };
  }
}
