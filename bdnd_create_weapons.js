/**
 * BtDatD — Import SHAMUS Edition Weapons
 *
 * Paste this script into a Foundry VTT macro (type: Script) and run it.
 * It creates all canonical weapons from the SHAMUS rulebook (pp. 29–31)
 * as world-level Items. Skips any weapon whose name already exists.
 */

const WEAPONS = [
  {
    name: "Boarding Ax",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage. When fighting an opponent who wields a smallsword or spadroon, may spend (only) 1 point Weapons or (only) 1 point of Scuffling to add +2 to the attack Test. May also spend 1 point Athletics to add +2 to Tests involving climbing during a boarding action. Not socially acceptable outside of pirate havens and battlefields."
    }
  },
  {
    name: "Boarding Pike",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage. Has Initiative when fighting against sword or ax users. Not socially acceptable outside of pirate havens and battlefields."
    }
  },
  {
    name: "Broadsword",
    system: {
      bonus:  2,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+2 Damage. Not socially acceptable outside of pirate havens and battlefields."
    }
  },
  {
    name: "Cutlass",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage. On a ship or in a tight area, may spend (only) 1 point Weapons to add +2 to the attack Test."
    }
  },
  {
    name: "Flintlock Musket",
    system: {
      bonus:  2,
      range:  "Ranged",
      ability: "firearms",
      ammo:   { value: 1, max: 1 },
      notes:  "+2 Damage. Bayonet: +1 Damage. Ranged weapons have Initiative when fighting only against melee opponents. Bayonets have Initiative when fighting against sword or ax users. Not socially acceptable outside of pirate havens and battlefields."
    }
  },
  {
    name: "Grenade",
    system: {
      bonus:  3,
      range:  "Ranged",
      ability: "traps_bombs",
      ammo:   { value: 1, max: 1 },
      notes:  "+3 Damage at point of impact; -1 Damage to characters within 20 feet. Anyone at the point of impact may make a Sense Trouble Test (TN 8) to leap away and suffer only -1 Damage instead."
    }
  },
  {
    name: "Queen Anne Pistol",
    system: {
      bonus:  2,
      range:  "Ranged",
      ability: "firearms",
      ammo:   { value: 1, max: 1 },
      notes:  "+2 Damage. Single-shot; reload requires a Firearms Test (TN 10) in combat. Ranged weapons have Initiative when fighting only against melee opponents."
    }
  },
  {
    name: "Rapier",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage."
    }
  },
  {
    name: "Sabre",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage. When fighting on horseback, may spend (only) 1 point Weapons to add +3 to the Damage Roll. Not socially acceptable outside of pirate havens and battlefields."
    }
  },
  {
    name: "Smallsword",
    system: {
      bonus:  0,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+0 Damage. In duels and 1-on-1 fights against an opponent wielding other types of swords, the smallsword user has the Initiative."
    }
  },
  {
    name: "Spadroon",
    system: {
      bonus:  1,
      range:  "Close",
      ability: "weapons",
      ammo:   { value: 0, max: 0 },
      notes:  "+1 Damage. When fighting against an opponent who wields a broadsword or bayonet, may spend (only) 1 point Weapons to add +2 to the TN of the opponent's next melee attack."
    }
  }
];

// --- Run ---

const existingNames = new Set(game.items.filter(i => i.type === "weapon").map(i => i.name));
const toCreate = WEAPONS.filter(w => !existingNames.has(w.name));
const skipped  = WEAPONS.filter(w =>  existingNames.has(w.name)).map(w => w.name);

if (toCreate.length === 0) {
  return ui.notifications.info("BtDatD: All weapons already exist — nothing to create.");
}

const created = await Item.createDocuments(
  toCreate.map(w => ({ name: w.name, type: "weapon", system: w.system }))
);

const lines = [
  `✅ Created ${created.length} weapon(s):`,
  ...created.map(i => `  • ${i.name}`),
  ...(skipped.length ? [`⏭ Skipped (already exist): ${skipped.join(", ")}`] : [])
];

ui.notifications.info(`BtDatD: ${created.length} weapon(s) created. Check console for details.`);
console.log("BtDatD Weapons Import\n" + lines.join("\n"));
