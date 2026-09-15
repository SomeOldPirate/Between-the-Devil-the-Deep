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

/** General Abilities that represent a combat attack roll. */
BDND.combatAbilities = new Set(["weapons", "scuffling", "firearms", "artillery", "traps_bombs"]);

/** Combat abilities that use the Range Band field (ranged attacks only). */
BDND.rangedAttackAbilities = new Set(["firearms", "artillery", "traps_bombs"]);

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

BDND.itemTypes = {
  item: "Item",
  lore_sheet: "Lore Sheet",
  weapon: "Weapon",
  condition: "Condition",
  armor: "Armor",
  spell: "Spell / Ritual",
  drive: "Drive",
  cherry: "Cherry"
};

/** Governing Ability options offered on the weapon item sheet. */
BDND.weaponAbilities = {
  weapons: "Weapons (Melee)",
  firearms: "Firearms (Guns)",
  athletics: "Athletics (Throwing)",
  scuffling: "Scuffling (Unarmed)",
  artillery: "Artillery (Cannons)"
};

/** Range options offered on the weapon item sheet. */
BDND.weaponRanges = {
  Close: "Close (Melee)",
  "Point Blank": "Point Blank (Pistol)",
  Medium: "Medium",
  Long: "Long"
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
 * NOTE: preserves the original (v1.3.3) list verbatim, which omits a few
 * General Abilities (e.g. "politics") present elsewhere in the system.
 */
BDND.cherryAbilities = {
  artillery: "Artillery",
  athletics: "Athletics",
  burglary: "Burglary",
  business_affairs: "Business Affairs",
  disguise: "Disguise",
  filch: "Filch",
  firearms: "Firearms",
  gambling: "Gambling",
  navigation: "Navigation",
  riding: "Riding",
  scuffling: "Scuffling",
  seamanship: "Seamanship",
  sense_trouble: "Sense Trouble",
  spell_casting: "Spell Casting",
  stealth: "Stealth",
  swimming: "Swimming",
  tinkering: "Tinkering",
  traps_bombs: "Traps & Bombs",
  weapons: "Weapons"
};

/* -------------------------------------------- */
/*  Range bands (General Ability test dialog)   */
/* -------------------------------------------- */

BDND.rangeBands = {
  pointblank: { label: "Point Blank / Exposed", tn: 6 },
  standard: { label: "Standard", tn: 8 },
  medium: { label: "Medium", tn: 10 },
  long: { label: "Long", tn: 12 }
};

/* -------------------------------------------- */
/*  NPC type                                    */
/* -------------------------------------------- */

/** Regular NPCs are Taken Out at max Health with no Conditions track; Named NPCs get full parity. */
BDND.npcTypes = { named: "Named", regular: "Regular" };

export default BDND;
