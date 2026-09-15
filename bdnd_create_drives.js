/**
 * BD&D — Between the Devil and the Deep
 * Macro: Create All Drives
 *
 * Run this macro once to populate your world with all 13 Drive items
 * from the SHAMUS edition. Drives can then be dragged onto PC sheets.
 *
 * Safe to re-run — skips any Drive that already exists by name.
 */

const drives = [
  {
    name: "Notoriety",
    description: "You took to the High Seas to make a name for yourself. You will do anything to ensure that your fame or infamy will live on long after you have slipped your mortal coil."
  },
  {
    name: "Power",
    description: "You live to exert your will onto others. You use whatever is at your disposal, whether it be pistols or navies, to gather and consolidate power."
  },
  {
    name: "Adventure",
    description: "You seek adventure on the High Seas. You take thrill in swashbuckling action, fierce battles and other daring and dangerous experiences."
  },
  {
    name: "Rebellion",
    description: "You live to overthrow the established world order. You will need ship and arms to fight against slavers, landowners, oppressors and the great European powers."
  },
  {
    name: "Arrogance",
    description: "You are stronger, faster and cleverer than others, or you at least believe that to be true. You may be narcissistic and most certainly have an exaggerated sense of self-worth and importance."
  },
  {
    name: "Revenge",
    description: "You seek retribution and revenge against someone who has done unforgivable harm to you or your loved ones. Status, even for scurvy pirates, is the only thing which conveys self-worth."
  },
  {
    name: "Carpe Diem",
    description: "Seize the day for a pirate's life is short. Take what you can and live life to the fullest."
  },
  {
    name: "Cursed",
    description: "You were born under a bad moon, suffer from bad luck or are the victim of a curse. Maybe you killed an albatross or did something else to deserve your fate. Either way, trouble follows you like a shadow."
  },
  {
    name: "Exploration",
    description: "You are driven by the spirit of exploration. Whether you are in search of El Dorado or monsters at the edge of the map, you are compelled by the desire to find new places."
  },
  {
    name: "Fanatic",
    description: "You are a zealot. You pursue extreme or excessive ends, often religious or political in nature, to be achieved by any means necessary."
  },
  {
    name: "Greed",
    description: "You have an insatiable thirst for wealth. You never have enough. You will need a ship and arms to transfer gold from other's pockets to yours."
  },
  {
    name: "Knowledge",
    description: "The greatest form of wealth is knowledge. You are driven by the desire to learn, discover and understand the world around you."
  },
  {
    name: "Nationalism",
    description: "You are driven by your identification with your own nation-state, and pursue interests in the furtherance of that nation-state."
  }
];

// Check which ones already exist
const existingNames = new Set(
  game.items.filter(i => i.type === "drive").map(i => i.name)
);

const toCreate = drives.filter(d => !existingNames.has(d.name));

if (toCreate.length === 0) {
  ui.notifications.info("BD&D | All Drives already exist in this world — nothing to create.");
} else {
  const itemData = toCreate.map(d => ({
    name: d.name,
    type: "drive",
    system: { description: d.description }
  }));

  await Item.createDocuments(itemData);

  const skipped = drives.length - toCreate.length;
  const msg = skipped > 0
    ? `BD&D | Created ${toCreate.length} Drive(s). Skipped ${skipped} already existing.`
    : `BD&D | Created all ${toCreate.length} Drives. Drag them from the Items sidebar onto a Captain's sheet.`;

  ui.notifications.info(msg);
  console.log("BD&D | Drives created:", toCreate.map(d => d.name));
}
