/**
 * Between the Devil & the Deep — system configuration constants.
 * @module bdnd/config
 */

export const SYSTEM_ID = "bdnd";

/** Convenience alias used throughout the system. */
export const BDND = {};

/* -------------------------------------------- */
/*  Approaches                                  */
/* -------------------------------------------- */

BDND.approaches = {
  forceful: "Forceful",
  slick: "Slick",
  flashy: "Flashy",
  agile: "Agile",
  focused: "Focused",
  deceptive: "Deceptive"
};

BDND.approachOrder = ["forceful", "slick", "flashy", "agile", "focused", "deceptive"];

/** SHAMUS: Stability Tests use Slick, Flashy, Focused, Deceptive. */
BDND.stabilityApproaches = ["slick", "flashy", "focused", "deceptive"];

/* -------------------------------------------- */
/*  Abilities                                   */
/* -------------------------------------------- */

BDND.generalAbilities = [
  "artillery", "athletics", "burglary", "business_affairs", "disguise", "filch",
  "firearms", "gambling", "navigation", "politics", "riding", "scuffling",
  "seamanship", "sense_trouble", "spell_casting", "stealth", "swimming",
  "tinkering", "traps_bombs", "weapons"
];

BDND.investigativeAbilities = [
  "alchemy", "anthropology", "architecture", "art_history", "belle_lettres",
  "bureaucracy", "flattery", "forgery", "high_society", "history", "inspire",
  "intimidation", "languages", "law", "leadership", "medicine", "military_tactics",
  "natural_philosophy", "negotiation", "occult", "outdoor_survival", "art",
  "cultures", "performance", "poetry", "reassurance", "repartee",
  "salt_of_the_sea", "sense_lies", "ship_building", "streetwise", "theology", "voodoo"
];

/** Words kept lower-case inside ability names ("Salt of the Sea"). */
const SMALL_WORDS = new Set(["of", "the", "and"]);

/** Labels that can't be derived from the key alone. */
const LABEL_OVERRIDES = { traps_bombs: "Traps & Bombs" };

/**
 * Human-readable label for an ability (or any snake_case) key.
 * @param {string} key
 * @returns {string}
 */
BDND.abilityLabel = key => {
  if (!key) return "—";
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  return key.split("_")
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/** General Abilities that represent a combat attack roll. */
BDND.combatAbilities = new Set(["weapons", "scuffling", "firearms", "artillery", "traps_bombs"]);

/** Combat abilities that use the Range Band field (ranged attacks only). */
BDND.rangedAttackAbilities = new Set(["firearms", "artillery", "traps_bombs"]);

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

/** Governing Ability options offered on the weapon item sheet. */
BDND.weaponAbilities = {
  weapons: "Weapons (Melee)",
  firearms: "Firearms (Guns)",
  athletics: "Athletics (Throwing)",
  scuffling: "Scuffling (Unarmed)",
  artillery: "Artillery (Cannons)",
  traps_bombs: "Traps & Bombs"
};

/** Range options offered on the weapon item sheet. */
BDND.weaponRanges = {
  Close: "Close (Melee)",
  "Point Blank": "Point Blank (Pistol)",
  Medium: "Medium",
  Long: "Long"
};

/** The attack-dialog Range Band a weapon's Range starts on (melee weapons have none). */
BDND.weaponRangeBand = {
  "Point Blank": "pointblank",
  Medium: "medium",
  Long: "long"
};

/** Spell "type" options offered on the spell item sheet. */
BDND.spellTypes = {
  casting: "Casting Ability Spell — requires Test (TN 8), drawn from Spell Casting pool",
  concoction: "Concoction / Ritual — always succeeds, drawn from Voodoo pool"
};

/** Condition "type" options offered on the condition item sheet. */
BDND.conditionTypes = {
  physical: "Physical",
  mental: "Mental"
};

/**
 * Parent Ability options offered on the cherry item sheet.
 * NOTE: preserves the original (v1.3.3) list, which omits Politics.
 */
BDND.cherryAbilities = Object.fromEntries(
  BDND.generalAbilities.filter(k => k !== "politics").map(k => [k, BDND.abilityLabel(k)])
);

/* -------------------------------------------- */
/*  Range bands (General Ability test dialog)   */
/* -------------------------------------------- */

BDND.rangeBands = {
  pointblank: { label: "Point Blank / Exposed", tn: 6 },
  standard: { label: "Standard", tn: 8 },
  medium: { label: "Medium", tn: 10 },
  long: { label: "Long", tn: 12 }
};

export default BDND;
