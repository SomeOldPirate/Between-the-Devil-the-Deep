/**
 * Lets a player change another actor's counters (Reassurance, Medicine on an
 * ally, Divide Plunder) by asking the active GM's client to make the update.
 * @module bdnd/socket
 */

const CHANNEL = "system.bdnd";

/** The only fields a player may change on an actor they don't own. */
const ALLOWED_PATHS = new Set([
  "system.health.value",
  "system.stability.value",
  "system.coin.value"
]);

/** Listen for relayed updates. Only the active GM acts on them. */
export function registerSocket() {
  game.socket.on(CHANNEL, async msg => {
    if (msg?.action !== "updateActor") return;
    if (game.users.activeGM !== game.user) return;
    const actor = await fromUuid(msg.uuid);
    if (!(actor instanceof Actor)) return;
    const data = Object.fromEntries(
      Object.entries(msg.data ?? {}).filter(([path, v]) => ALLOWED_PATHS.has(path) && Number.isFinite(v))
    );
    if (Object.keys(data).length) await actor.update(data);
  });
}

/**
 * Update an actor directly if this user owns it, otherwise relay the update
 * to the active GM.
 * @param {Actor} actor
 * @param {Record<string, number>} data  Flat dot-path updates (allowed paths only when relayed).
 * @returns {Promise<boolean>} Whether the update was made or sent.
 */
export async function updateActorAnywhere(actor, data) {
  if (actor.isOwner) {
    await actor.update(data);
    return true;
  }
  if (!game.users.activeGM) {
    ui.notifications.warn(`A GM must be logged in to change ${actor.name}.`);
    return false;
  }
  game.socket.emit(CHANNEL, { action: "updateActor", uuid: actor.uuid, data });
  return true;
}
