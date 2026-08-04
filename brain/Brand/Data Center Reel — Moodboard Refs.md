# Data-center reel — moodboard reference fetch list

For the v2 news-alert reel. **Fetch from a machine with normal internet** —
both agent containers are blocked from every image CDN by network policy
(`connect_rejected` on commons.wikimedia.org, upload.wikimedia.org,
api.openverse.org, images.unsplash.com, live.staticflickr.com).

## Rules that shaped this list

1. **Own photos first.** The AZ Homes moodboard proved own-library beats
   stock: same authenticity, zero rights questions. Anything below marked
   OWN should come from Taylor's pool before anyone downloads a substitute.
2. **Wikimedia Commons is the source of record** for what he doesn't have —
   CC/PD licensed, verifiable, safe as a reference. Openverse
   (`license_type=commercial`) is the fallback. Avoid image-search grabs:
   unknown license, and these feed a generative tool.
3. **Reference ≠ output.** These steer style only. Generated frames must NOT
   depict an identifiable real facility or carry real corporate branding
   (ruling, Editorial Direction 2026-08-02). TSMC Fab 21 as a *reference* for
   "vast low industrial campus at desert scale" is fine; a generated frame
   that reads as TSMC's actual building is not.
4. **No outlet logos, no real signage** in any generated frame.

## The 16

| # | Need | Source | Note |
|---|---|---|---|
| 1 | Semiconductor/industrial campus at desert scale | [File:231105-1 TSMC Fab 21 construction.jpg](https://commons.wikimedia.org/wiki/File:231105-1_TSMC_Fab_21_construction.jpg) | The Arizona fab. Style ref for scale only |
| 2–3 | Data center exteriors | [Category:Data centers](https://commons.wikimedia.org/wiki/Category:Data_centers) (178 files) — incl. [File:Data center roof.jpg](https://commons.wikimedia.org/wiki/File:Data_center_roof.jpg) (CC0) | Pick windowless-box exteriors + one roof/HVAC plant |
| 4–5 | Electrical substations | [Category:Electrical substations in the United States](https://commons.wikimedia.org/wiki/Category:Electrical_substations_in_the_United_States) (200+ files) | Prefer desert/arid settings; one wide, one transformer-detail |
| 6 | Transmission lines, arid landscape | Same category tree | The "load leaves town" frame |
| 7–8 | Phoenix downtown skyline / aerial | [Category:Phoenix, Arizona](https://commons.wikimedia.org/wiki/Category:Phoenix,_Arizona) | One skyline, one sprawl-to-desert-edge aerial |
| 9 | Camelback Mountain | [Category:Camelback Mountain](https://commons.wikimedia.org/wiki/Category:Camelback_Mountain) | Recognizable to any local — anchors "here" |
| 10 | Papago Park / buttes | [Category:Papago Park](https://commons.wikimedia.org/wiki/Category:Papago_Park) (25 files) | |
| 11 | Superstition Mountains | [Category:Superstition Mountains](https://commons.wikimedia.org/wiki/Category:Superstition_Mountains) | |
| 12–13 | Suburban neighborhoods adjacent to industry | **OWN** — the AZ Homes board already has night/street exteriors | Reuse; download nothing |
| 14 | Rooftop AC units / heat-stressed home | **OWN** — rooftop + install close-ups in his pool | Reuse |
| 15 | Commuter / at-home bill-pain frame | **GENERATE** — no honest stock exists; Soul or generic | Real people photos here would misrepresent strangers as customers |
| 16 | Desert vista / heat haze | **OWN** — desert vista already in the AZ Homes board | Reuse |

**Net downloads required: 9–11.** Seven come from Taylor's own library or
generation. The mountains and skyline (7–11) do the most work per file —
they make the reel unmistakably *here*, which is the whole local-authority play.

## Fetch method

Browser → the category page → open the file page → "Original file" → save.
Record filename + author + license from the file page for each: Commons
requires attribution for CC-BY, and the reel's own sourcing standard
(rule 14) means we keep receipts on references too, not just facts.
