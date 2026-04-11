/**
 * BD&D — Between the Devil and the Deep
 * Macro: Create All Cherries
 *
 * Run this macro once to populate your world with all 19 Cherry items
 * from the SHAMUS edition. Cherries can then be dragged onto PC or NPC sheets.
 *
 * Safe to re-run — skips any Cherry that already exists by name.
 *
 * Each Cherry is pre-configured with:
 *  - Parent ability key
 *  - Health / Stability max bonuses (where applicable)
 *  - Post-roll spend flag (where applicable)
 *  - Full rules description
 */

const cherries = [
  {
    name: "Ironman",
    ability: "athletics",
    health_max_bonus: 2,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "You have +2 to the maximum Health Risk Counter.\n\n(Athletics Cherry)"
  },
  {
    name: "Cannoneer",
    ability: "artillery",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "When you perform a Broadside Action, the enemy loses an additional 2 Sailors (or Soldier points) or 1 Sail.\n\n(Artillery Cherry)"
  },
  {
    name: "Burglary Post-Roll",
    ability: "burglary",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result.\n\n(Burglary Cherry — unnamed in rules)"
  },
  {
    name: "Merchant Master",
    ability: "business_affairs",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "All merchants will trade with you in any market. If the market would normally be closed to you due to your nationality or your pirate demeanor, Booty and Commodities may be traded for Coins at a 2 for 1 ratio. Spending 3 points of Business Affairs changes the exchange of Booty to Commodities to a 1 for 1 ratio.\n\n(Business Affairs Cherry)"
  },
  {
    name: "Chameleon",
    ability: "disguise",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "In 3 separate cities, you are known by separate identities, each with their own reputation. Furthermore, when applying Disguise Ability to your ship, you may spend 2 points on this Ability after the Test to add +1 to the result.\n\n(Disguise Cherry)"
  },
  {
    name: "Sharpshooter",
    ability: "firearms",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "When shooting at a target Range, you may spend 2 points of Firearms to add +1 to the attack after the roll. If the Test is successful, you may choose to inflict 0 damage but shoot out the target's weapon.\n\n(Firearms Cherry)"
  },
  {
    name: "Nibblefinger",
    ability: "filch",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result.\n\n(Filch Cherry)"
  },
  {
    name: "Card-sharp",
    ability: "gambling",
    health_max_bonus: 0,
    stability_max_bonus: 1,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result. Furthermore, add +1 to the Stability Risk Counter max.\n\n(Gambling Cherry)"
  },
  {
    name: "Wayfinder",
    ability: "navigation",
    health_max_bonus: 0,
    stability_max_bonus: 1,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result. At all times under the heavens, you know exactly where you are. Furthermore, add +1 to the Stability Risk Counter max.\n\n(Navigation Cherry)"
  },
  {
    name: "Horse Master",
    ability: "riding",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "While mounted, you may spend points from this ability on attack rolls, as well as spend 1 point (max) to add +1d6 to a damage roll.\n\n(Riding Cherry)"
  },
  {
    name: "Street Style",
    ability: "scuffling",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "You can spend 2 points to make a second Scuffling attack in the same Round. Instead of attacking, you can spend 2 points to disarm an opponent (TN 5 — if the opponent has a relevant Cherry Ability, TN is 6).\n\n(Scuffling Cherry)"
  },
  {
    name: "Sea Master",
    ability: "seamanship",
    health_max_bonus: 0,
    stability_max_bonus: 2,
    has_post_roll_spend: false,
    description: "You are a legendary sea master. Anytime your ship would be destroyed, spend 2 points of Seamanship or Navigation to prevent disaster. You may spend 1 point of Navigation or Seamanship to add +2 to a Test to sail faster than opponents. Additionally, you have +2 to the max Stability Risk Counter.\n\n(Seamanship Cherry)"
  },
  {
    name: "Danger-sense",
    ability: "sense_trouble",
    health_max_bonus: 0,
    stability_max_bonus: 1,
    has_post_roll_spend: false,
    description: "When combat Ability Rating is used to establish Initiative Order, you may use Sense Trouble as the rating. When suddenly encountering another character, you may spend 1 point to be able to make a Stealth Test before the other character sees you. Furthermore, add +1 to the Stability Risk Counter max.\n\n(Sense Trouble Cherry)"
  },
  {
    name: "Magic User Baby!",
    ability: "spell_casting",
    health_max_bonus: 0,
    stability_max_bonus: 2,
    has_post_roll_spend: false,
    description: "You can spend points from the Spell Casting Ability whenever you use your magical Investigative Ability. Additionally, you have +2 to the max Stability Risk Counter.\n\n(Spell Casting Cherry)"
  },
  {
    name: "Shadowhand",
    ability: "stealth",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result. When attacking from the shadows, you may spend 1 point to add +1d6 damage.\n\n(Stealth Cherry)"
  },
  {
    name: "Not Coming Up",
    ability: "swimming",
    health_max_bonus: 2,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "When in the water, if spotted by an enemy, spend 1 point to disappear and convince the enemy you were never there (or drowned). When fighting in the water with an opponent who does not have the Swimming Ability, spend 1 point to drown them. Additionally, you have +2 to your max Health Risk Counter.\n\n(Swimming Cherry)"
  },
  {
    name: "Master Builder",
    ability: "tinkering",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: true,
    description: "You may spend 2 points on this Ability after the Test to add +1 to the result.\n\n(Tinkering Cherry)"
  },
  {
    name: "Munitions Master",
    ability: "traps_bombs",
    health_max_bonus: 0,
    stability_max_bonus: 1,
    has_post_roll_spend: false,
    description: "Any time a grenade or explosive is used, spend 2 points to either add an extra die of damage or add an extra +1d6 to a counter. Additionally, you have +1 to the max Stability Risk Counter.\n\n(Traps & Bombs Cherry)"
  },
  {
    name: "Weapons Mastery",
    ability: "weapons",
    health_max_bonus: 0,
    stability_max_bonus: 0,
    has_post_roll_spend: false,
    description: "The base TN for opponents to hit you in melee combat is now 6. Additionally, choose one specialisation:\n\n• British Style: With a spadroon or broadsword, spend 1 point to increase the opponent's TN by 3.\n• Florentine Style: With a rapier in one hand and a dagger in the other, spend 1 point to add 1d6 damage.\n• French Style: With a smallsword or rapier, spend 1 point to add +2 to the attack Test; your attack is made before your opponents and the new turn order is maintained for the whole combat.\n• Seadog Style: While fighting and doing things to make yourself seem especially scary, spend 1 point to add 1d6 damage.\n• Swashbuckler Style: When performing feats of acrobatics (swinging, leaping onto the target, flamboyant swordplay), spend 1 point to add +2 to the attack Test.\n\nRecord your chosen style in the Cherry description.\n\n(Weapons Cherry)"
  }
];

// Check which already exist
const existingNames = new Set(
  game.items.filter(i => i.type === "cherry").map(i => i.name)
);

const toCreate = cherries.filter(c => !existingNames.has(c.name));

if (toCreate.length === 0) {
  ui.notifications.info("BD&D | All Cherries already exist in this world — nothing to create.");
} else {
  const itemData = toCreate.map(c => ({
    name: c.name,
    type: "cherry",
    system: {
      ability:              c.ability,
      health_max_bonus:     c.health_max_bonus,
      stability_max_bonus:  c.stability_max_bonus,
      has_post_roll_spend:  c.has_post_roll_spend,
      description:          c.description
    }
  }));

  await Item.createDocuments(itemData);

  const skipped = cherries.length - toCreate.length;
  const msg = skipped > 0
    ? `BD&D | Created ${toCreate.length} Cherry item(s). Skipped ${skipped} already existing.`
    : `BD&D | Created all ${toCreate.length} Cherries. Drag them from the Items sidebar onto a Captain's sheet.`;

  ui.notifications.info(msg);
  console.log("BD&D | Cherries created:", toCreate.map(c => c.name));
}
