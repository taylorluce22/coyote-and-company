/**
 * Operator multi-client mode (E1) — the founder runs Farmhand as a done-with-you
 * service, servicing many client accounts from one browser. Each client is an
 * isolated account: its own app-state localStorage key and its own IndexedDB
 * image/reel vaults. This module owns the client REGISTRY (the list the switcher
 * shows) plus client bundle export/import (E1-3) so a paying client's data can
 * be backed up and restored — critical while state still lives in the browser.
 *
 * Back-compat: the original two hardcoded workspaces ("default" realtor test
 * user, "solar" real account) are seeded into the registry with their original
 * ids and storage keys, so every existing byte of data loads untouched.
 */

import { vaultAllFor, vaultAddManyTo, deleteVaultDb, type VaultImage } from "./vault";

export type ClientId = string;

export interface ClientMeta {
  id: ClientId;
  label: string;
  emoji: string;
  vertical?: "realtor" | "solar";
  createdAt: number;
}

const CLIENTS_KEY = "farmhand-clients";
const APP_STATE_BASE = "farmhand-studio-v1";

/** The two accounts that predate multi-client mode — seeded so their data loads. */
export const SEED_CLIENTS: ClientMeta[] = [
  { id: "default", label: "Realtor · test user", emoji: "🏠", vertical: "realtor", createdAt: 0 },
  { id: "solar", label: "My Solar · real", emoji: "☀️", vertical: "solar", createdAt: 0 },
];

/** localStorage key for a client's persisted app state. "default" keeps the
    original unsuffixed key so the existing realtor account is untouched. */
export const persistKeyFor = (id: ClientId): string =>
  id === "default" ? APP_STATE_BASE : `${APP_STATE_BASE}::${id}`;

export function loadClients(): ClientMeta[] {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) {
        // guarantee the two seed accounts always exist (never orphan their data)
        const byId = new Map<string, ClientMeta>(list.map((c: ClientMeta) => [c.id, c]));
        for (const seed of SEED_CLIENTS) if (!byId.has(seed.id)) byId.set(seed.id, seed);
        return [...byId.values()];
      }
    }
  } catch {}
  return [...SEED_CLIENTS];
}

export function saveClients(list: ClientMeta[]): void {
  try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(list)); } catch {}
}

/** A url/DB-safe id derived from the label, guaranteed unique and never a
    reserved seed id. Randomness varies by a time suffix to avoid collisions. */
export function makeClientId(label: string, existing: ClientMeta[]): ClientId {
  const base = (label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client").slice(0, 24);
  const taken = new Set(existing.map((c) => c.id));
  let id = base;
  let n = 2;
  while (taken.has(id) || id === "default" || id === "solar") id = `${base}-${n++}`;
  return id;
}

// ————— client bundle export / import (E1-3): the backup story —————

export interface ClientBundle {
  version: 1;
  kind: "farmhand-client-bundle";
  client: ClientMeta;
  state: unknown; // the persisted app-state snapshot (PERSIST_FIELDS)
  images: VaultImage[];
  exportedAt: number;
}

/** Snapshot a client to a portable bundle (app state + every vault image). */
export async function exportClientBundle(client: ClientMeta): Promise<ClientBundle> {
  let state: unknown = null;
  try {
    const raw = localStorage.getItem(persistKeyFor(client.id));
    state = raw ? JSON.parse(raw) : null;
  } catch {}
  const images = await vaultAllFor(client.id);
  return { version: 1, kind: "farmhand-client-bundle", client, state, images, exportedAt: Date.now() };
}

/**
 * Restore a bundle as a NEW client (never overwrites an existing one — import is
 * always additive so a restore can't clobber a live account). Returns the new
 * client meta so the caller can register + switch to it.
 */
export async function importClientBundle(bundle: ClientBundle, existing: ClientMeta[]): Promise<ClientMeta | null> {
  if (!bundle || bundle.kind !== "farmhand-client-bundle" || !bundle.client) return null;
  const label = `${bundle.client.label} (restored)`.slice(0, 60);
  const id = makeClientId(label, existing);
  const meta: ClientMeta = { id, label, emoji: bundle.client.emoji || "🗂️", vertical: bundle.client.vertical, createdAt: Date.now() };
  try {
    if (bundle.state) localStorage.setItem(persistKeyFor(id), JSON.stringify(bundle.state));
  } catch {}
  if (Array.isArray(bundle.images) && bundle.images.length) {
    await vaultAddManyTo(id, bundle.images);
  }
  return meta;
}

/** Remove a client everywhere: registry entry, app-state key, and vault DB.
    The two seed accounts can't be deleted (they hold the original test data). */
export async function purgeClient(id: ClientId): Promise<void> {
  if (id === "default" || id === "solar") return;
  try { localStorage.removeItem(persistKeyFor(id)); } catch {}
  await deleteVaultDb(id);
}
