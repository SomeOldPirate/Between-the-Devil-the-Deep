# BD&D System Changelog

## [2.0.1] — 2026-09-16

### Fixed

- Item sheet portraits were missing their sizing class, so images rendered at full natural size instead of a proper thumbnail. Added an `item-portrait` style matching the actor sheet portraits.

## [2.0.0] — 2026-09-15

### Changed — Rebuilt for Foundry V14

- **Full rebuild onto V14 idioms.** Replaced the legacy `template.json` data model with per-type `TypeDataModel` classes, rebuilt every AppV1 `ActorSheet`/`ItemSheet` (Captain, NPC, Ship, Counter Board, Item) as `ApplicationV2` sheets, and converted every jQuery `new Dialog(...)` roll prompt (General Ability Test, Clutch Test, Stability Test, Contest, Cooperation, Spell Casting, and more) to `DialogV2`.
- Ported the custom `Combat` subclass (SHAMUS initiative reference card), the combat-tracker drag-to-reorder, and the 🪙 coin-flip button to native DOM — no more jQuery anywhere in the system.
- `compatibility` raised to minimum 14 / verified 14.367. **This release requires Foundry V14 and will no longer run on V12/V13.**
- Added `lang/en.json` so sheet titles show proper labels ("Captain: Name", "Ship: Name", etc.) instead of Foundry's raw fallback key.
- Fixed a chat-message crash caused by `ChatMessage.TYPES`/`CONST.CHAT_MESSAGE_TYPES`, both removed in V14.
- Fixed a console error thrown on every actor update, caused by a `prepareBaseData()` override that skipped a core cleanup step.
- Character sheet: window title now shows just the character's name (not every PC is a Captain), and its window icon now matches the NPC sheet's skull & crossbones.
- No gameplay rules, dice math, or item/actor data changed — this is a platform rebuild, not a rules update.

## [1.3.3] — 2026-06-20

### Added — Weapons & Equipment Compendiums

- New compendium pack **"Weapons & Equipment — Weapons"** containing all 11 weapons from SHAMUS pp. 29–31 with full stats, special rules, and descriptions.
  - Boarding Ax (Scuffling +1), Boarding Pike (Weapons +1), Broadsword (Weapons +2), Cutlass (Weapons +1), Flintlock Musket (Firearms +2, 1 shot), Grenade (Traps & Bombs +3, AoE), Queen Anne Pistol (Firearms +2, 1 shot), Rapier (Weapons +1), Sabre (Weapons +1), Smallsword (Weapons +0), Spadroon (Weapons +1)
  - Each weapon includes its special spend ability (e.g. Cutlass ship bonus, Smallsword duel initiative, Grenade splash rules) in the notes field.
- New compendium pack **"Weapons & Equipment — Sundry Items"** containing 13 equipment and commodity entries drawn from SHAMUS pp. 26–27 and the Magic & Voodoo chapter.
  - **Kits & Gear:** Standard Kit (1 Coin), Custom Side-arm (2 Coins), Exotic Weapon or Armour (3 Coins)
  - **Commodities** (1 unit = 1 Booty = 1 Coin): Indigo, Tobacco, Rum, Molasses
  - **Spell Components:** Spell Components (Cheap), Talisman / Sacrificial Component, Mojo Bag, Veve Salt Patterns, Ritual Jewelry (3 Coins, for Crossroads Summon), Sympathetic Link

## [1.3.2] — 2026-06-20

### Added — Spell & Ritual Compendium

- New compendium pack **"Magic & Voodoo — Spells & Rituals"** containing all 25 spells from SHAMUS pp. 34–36, ready to drag onto character sheets.
- **9 Level 1 Casting Ability Spells** (⚡): Favor from Agwe Flambeau, Hair on Fire, Hat Trick, Legba's Protection, Loan from Ayizan, Mambo's Strength, Salutation to Met Agwe, Sweet Whispers, Uncanny Cloak.
- **4 Level 1 Concoction Rituals** (🌀): Call of Commodore Papa Agwe, Face of Erzulie, Friend of Legba Atibon, Trail of Gran Bwa.
- **5 Level 2 Casting Ability Spells** (⚡): Attentions of Loco, Curse from Sousson-Pannan, Infusion of Marinette Bras Cheche, Legba's Shield, Wrath of Guabancex.
- **3 Level 2 Concoction Rituals** (🌀): Baron Samedi's Curse, Benediction to Papa Guede, Favor of Erzulie Freda.
- **4 Level 3 Concoction Rituals** (🌀): Crossroads Summon, Second Sight of Gede Doub, Summon Demon, Twins of Mami Wata.
- All spells include full rulebook description, correct spell type, level, and default TN. Stability damage is calculated automatically at cast time (level × 2).

## [1.3.1] — 2026-06-20

### Fixed — Magic system brought to RAW (SHAMUS p.32–36)

- **Two spell types now distinct.** Spells have a `spell_type` field: *Casting Ability* (requires a Test at TN 8, draws from Spell Casting General pool) vs *Concoction / Ritual* (always succeeds, draws from Voodoo Investigative pool). Previously all spells were treated identically.
- **Correct stability damage formula.** Was `level` points; now `level × 2` (Level 1 = 2, Level 2 = 4, Level 3 = 6) per RAW.
- **No stability damage on a failed Casting spell.** RAW: if the Test fails, the PC suffers no Stability damage. The old code always charged it.
- **Four stability reduction methods implemented.** Ceremony/Loa possession (−2), Drive-related pool spend (up to 2 pts, 1-for-1), Component/talisman (costs 1 Coin per spell level, −1), Lore Sheet spend related to target (−1). These are now checkboxes/inputs in the cast dialog.
- **Concoction rituals post without a dice roll.** Chat card reads "RITUAL PERFORMED SUCCESSFULLY — the Loa have answered." with Stability damage breakdown only.
- **Spell levels corrected to 1–3.** Item sheet now shows Level 1 / 2 / 3 (Minor / Major / Greater). Removed the D&D-derived five-tier Cantrip–Ritual ladder.
- **Default TN corrected to 8** (was 5). TN field hidden on Concoction spells since no Test is rolled.
- **Removed unskilled −2 penalty.** Not present in RAW magic rules.

## [1.3.0] — 2026-06-17

### Added

**GM Counter Tracker** (Priority 1)
- New `counter_board` actor type with dedicated `BDNDCounterBoardSheet`
- Supports any number of named Risk and Progress Counters (stored as JSON per SHAMUS pp. 23–25)
- Per-counter actions: ±1 manual step, +1d6 GM trigger, −1d6 PC reduction (all post to chat)
- Colour-coded progress bars: safe (green) → warning (amber) → danger (red)
- Auto-posts a chat alert when any counter reaches its maximum
- GM Notes textarea for threshold descriptions and trigger conditions

**Auto Taken Out → Clutch Test prompt** (Priority 1)
- `updateActor` hook detects when a character's or NPC's Health counter reaches maximum
- Posts a chat card with a one-click **Roll Clutch Test** button for Named NPCs/PCs
- Regular NPCs get a "Taken Out immediately" notice instead (no Conditions track)
- Flag-gated so the alert fires once per hit-max event; clears automatically on recovery

**Condition −1 badge on approach display** (Priority 1)
- Condition badges now appear inline next to the approach name on both PC and NPC sheets
- Red pill = physical Condition; navy pill = mental Condition
- Tooltip names the Condition and which approach it penalises

**Token resource bars** (Priority 2)
- `CONFIG.Actor.trackableAttributes` declared for `character` and `npc` types
- `_preCreate` hook auto-assigns `bar1 = health`, `bar2 = stability` on all new tokens

**Flanking / Fleeing** (Priority 2)
- **Flee!** button added to the General tab toolbar; opens Athletics test dialog with TN pre-filled to 6 + number of foes (SHAMUS p.21)
- Flanking Advantage checkbox already present in the combat roll dialog (TN −2, attacking from behind)

**Medicine ability spend** (Priority 2)
- Syringe icon button (`use-medicine`) in the General abilities table, Medicine row only
- 1 pt spent heals 3 Health Counter for a targeted ally, or 1 Health Counter when self-treating (SHAMUS p.21)
- Uses Foundry's targeting system (`game.user.targets`) to identify the recipient

**Simplified NPC sheet** (Priority 2)
- NPC Type toggle at the top of every NPC sheet: **Named** (full Conditions track) vs **Regular** (Taken Out at max counter)
- Conditions section hidden for Regular NPCs; replaced with explanatory notice
- Flag stored per-actor via `getFlag/setFlag('bdnd', 'npcType')`

### Changed
- `BDNDNPCSheet` now extends `BDNDActorSheet` with `getData()` override (passes `isRegularNPC` to template) and `activateListeners()` override (wires toggle button)
- `actor-sheet.mjs` `getData()` extended: `approachList` entries now include `conditionBadges` array
- `bdnd.mjs`: imports `BDNDCounterBoardSheet`; registers it for `counter_board` type; adds preload entry; adds two `updateActor` hooks

---

## [1.2.7] — prior session

- Range bands for ranged weapons (Firearms, Artillery, Traps & Bombs): Point Blank TN 6 / Standard TN 8 / Medium TN 10 / Long TN 12 dropdown in attack dialog
- Auto-roll damage on successful hit: when attacking via weapon name click, damage (1d6 + bonus) rolls automatically on success
- Flanking Advantage checkbox in combat roll dialog (TN −2)

## [1.2.x] — earlier sessions

- Full GUMSHOE/SHAMUS system: approaches, general + investigative abilities, pool spending
- Weapons, armour, conditions, cherries, lore sheets, spells, drive items
- PC sheet, NPC sheet, Ship Tracker, Item sheet
- SHAMUS initiative reference card; coin flip (Tails wins); drag-to-reorder combat tracker
- Clutch Test, Stability Test, Contest, Cooperation, Reassurance spend
- Dice So Nice: Piece of Eight coin die + pirate bone d6
- Condition penalty applied automatically to relevant approach rolls
