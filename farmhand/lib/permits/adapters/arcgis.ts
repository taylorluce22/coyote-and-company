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
