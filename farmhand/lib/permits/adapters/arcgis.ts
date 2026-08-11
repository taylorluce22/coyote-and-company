/**
 * Minimal ArcGIS REST query client, shared by the Peoria and Buckeye adapters.
 *
 * Both cities publish permits as public ArcGIS feature/map layers with no auth
 * and no token. Paging is `resultOffset`/`resultRecordCount` and the server
 * caps a page at its own `maxRecordCount` (Peoria 5000, Buckeye 2000), so the
 * caller passes the layer's real cap rather than a hopeful number.
 *
 * `exceededTransferLimit` is the authoritative "there is more" signal; a short
 * page is the fallback, since some servers omit the flag on the final page.
 */

export interface ArcGisFeature<T = Record<string, unknown>> {
  attributes: T;
}

interface ArcGisQueryResponse<T> {
  features?: ArcGisFeature<T>[];
  exceededTransferLimit?: boolean;
  error?: { message?: string; details?: string[] };
}

export interface ArcGisQueryOptions {
  /** Layer URL, ending in the layer index (e.g. .../FeatureServer/0). */
  layerUrl: string;
  /** SoQL-ish WHERE clause. "1=1" for everything. */
  where: string;
  outFields: string[];
  /** The layer's own maxRecordCount. */
  pageSize: number;
  /** Hard ceiling across all pages. */
  maxRows?: number;
  fetchImpl?: typeof fetch;
  /** Field to order by — paging without a stable order can repeat or skip rows. */
  orderBy?: string;
}

export async function arcgisQueryAll<T = Record<string, unknown>>(
  opts: ArcGisQueryOptions
): Promise<T[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRows = opts.maxRows ?? 60000;
  const out: T[] = [];

  for (let offset = 0; offset < maxRows; offset += opts.pageSize) {
    const params = new URLSearchParams({
      where: opts.where,
      outFields: opts.outFields.join(","),
      returnGeometry: "false",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(Math.min(opts.pageSize, maxRows - offset)),
    });
    if (opts.orderBy) params.set("orderByFields", opts.orderBy);

    const res = await fetchImpl(`${opts.layerUrl}/query?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`arcgis ${res.status} on ${opts.layerUrl}`);
    const body = (await res.json()) as ArcGisQueryResponse<T>;
    // ArcGIS reports failures inside a 200 response, so status alone isn't enough.
    if (body.error) throw new Error(`arcgis error: ${body.error.message ?? "unknown"}`);

    const features = body.features ?? [];
    for (const f of features) out.push(f.attributes);
    if (!body.exceededTransferLimit && features.length < opts.pageSize) break;
    if (features.length === 0) break;
  }
  return out;
}

/**
 * Distinct values of one field. This is the first call any new adapter should
 * make — see the vocabulary rule in ./README.md. These sources differ in
 * VOCABULARY, not in access: Mesa says "PV SOLAR", Buckeye says
 * "Photovoltaic", Peoria uses the checklist code "801 - Photovoltaic RES".
 * A keyword carried over from another city returns zero and looks like a
 * coverage gap.
 */
export async function arcgisDistinctValues(
  layerUrl: string,
  field: string,
  where = "1=1",
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const params = new URLSearchParams({
    where,
    outFields: field,
    returnDistinctValues: "true",
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetchImpl(`${layerUrl}/query?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`arcgis ${res.status} on ${layerUrl}`);
  const body = (await res.json()) as ArcGisQueryResponse<Record<string, unknown>>;
  if (body.error) throw new Error(`arcgis error: ${body.error.message ?? "unknown"}`);
  return (body.features ?? [])
    .map((f) => String(f.attributes?.[field] ?? "").trim())
    .filter(Boolean);
}

export class VocabularyDriftError extends Error {
  constructor(
    readonly layerUrl: string,
    readonly field: string,
    readonly missing: string[],
    readonly live: string[]
  ) {
    super(
      `vocabulary drift on ${field}: configured value(s) [${missing.join(", ")}] matched no rows. ` +
        `Live distinct values are [${live.slice(0, 40).join(", ")}]. ` +
        `Refusing to return a silently-empty result — update the adapter's vocabulary.`
    );
    this.name = "VocabularyDriftError";
  }
}

export interface VocabularyCheck {
  field: string;
  /** Values this adapter depends on. Every one must still match rows. */
  expected: string[];
  /** Restrict the distinct query, e.g. to PV rows only. */
  where?: string;
}

/**
 * Fail loudly when a configured vocabulary value stops matching anything.
 *
 * The whole point: an adapter that returns zero must be an ERROR, never a
 * result. A city renaming a workclass would otherwise show up as "that city
 * has no solar permits" and sit there looking like a coverage gap.
 */
export async function assertVocabulary(
  layerUrl: string,
  checks: VocabularyCheck[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  for (const check of checks) {
    const live = await arcgisDistinctValues(layerUrl, check.field, check.where ?? "1=1", fetchImpl);
    const liveUpper = new Set(live.map((v) => v.toUpperCase()));
    const missing = check.expected.filter((e) => !liveUpper.has(e.toUpperCase()));
    if (missing.length) throw new VocabularyDriftError(layerUrl, check.field, missing, live);
  }
}

/** Count-only query — cheap way to verify a WHERE clause before pulling rows. */
export async function arcgisCount(
  layerUrl: string,
  where: string,
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  const params = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
  const res = await fetchImpl(`${layerUrl}/query?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`arcgis ${res.status}`);
  const body = (await res.json()) as { count?: number; error?: { message?: string } };
  if (body.error) throw new Error(`arcgis error: ${body.error.message ?? "unknown"}`);
  return body.count ?? 0;
}
