# Module design: hidden map

Provenance: platform

> Registry id `hidden-map`, named "Hidden map". The rules are `shared/hiddenMap.ts`; the decisions are
> `server/lib/hiddenMap.ts`; every statement is in `server/repos/hiddenMap.ts`; the routes are
> `server/routes/hiddenMap.ts`; the schema is `drizzle/0392_a_hidden_map_opens_to_those_who_plant.sql`.

**A members-only map of the places your members log, with photos, growth over time and return visits. Each member
sees only their own pins until enough of them are vouched for by others, and then the whole map opens.**

A village names it in its own words. The layer names and the kinds of place are the module's settings, so nothing a
member reads about the map is fixed in platform code.

## Status

Ships OFF, like every non-core module, and can never stand wider than `members` (`widest: "members"` in the
registry entry; the lifecycle write refuses `public` with a 409).

Built:
- **S1, this release:** the rules, every table, pins with photos, vouches, opening, return visits, the two-person
  export, the who-looked log and its retention job, a member's own export and erasure.

Not built yet:
- S2: the page (capture, reading the location from a photo, the cover tool for faces, the map).
- S3: return visits opening a quest claim (`returnVisitQuestId`).
- S4: capture with no signal (an IndexedDB outbox).
- S5 (optional): seed origins from the library.

## Setup

1. Put somebody in a role that holds `hiddenmap.keep` (and, for exports, a second person in a role that holds
   `hiddenmap.export`). On day one nobody's map is open, so the keeper is who vouches the first members through.
2. Choose what the map is drawn on (`hiddenmap.basemap`). The default is a plain grid, which sends nothing anywhere.
3. Optionally rename the layers, change the kinds, or open a layer to every member (module settings: `labels`,
   `kinds`, `openLayers`).

## The words

- **Pin:** one logged place: a layer, a kind, coordinates, words, photos, and a stage for plantings.
- **Layers:** `planting`, `partner` (with a state: connected, visited, planted), `stop` (where the village's
  vehicles can stop).
- **Stage:** seed, sprout, sapling, tree, or lost ("didn't make it"). The latest return visit that saw a stage sets
  it, and a later visit can bring a lost planting back.
- **Open:** a member whose own planting pins have reached `hiddenmap.unlock_pins` (default 7), each with at least
  `hiddenmap.vouches_per_pin` (default 1) live vouches from somebody else. Opening is recorded once and never undone:
  raising the dial, withdrawing a vouch or hiding a pin never closes a map it opened.
- **Shown precision:** per pin, exact, about 1 km, or about 50 km. It is the finest anybody outside the open members
  is ever shown. Coarse points snap to the centre of a fixed grid cell (0.01 or 0.5 degrees), never random jitter.

## Who sees what

One function decides it, `visiblePin` in `shared/hiddenMap.ts`, and every read calls it.

| Viewer | Sees |
|---|---|
| A visitor | nothing, at every lifecycle |
| A member whose map is closed | their own pins; pins in a layer the village opened; with `hiddenmap.teaser` on, other pins as dots no finer than about 1 km with no words, photos or stage |
| A keeper whose map is closed | the above, plus the queue of pins still waiting for a vouch, so the first members can be vouched for |
| An open member | every pin that is not hidden |
| The pin's owner | their own pin always, marked hidden if a keeper hid it |

**No answer carries the owner.** A pin says `mine: true|false` and a count of vouches, to everybody, the keeper
included. A photo is served only where its pin may be read in full.

**The keeper and the second signer hold roles.** Both powers are read through the one gate with the admin
short-circuit set aside, so being an administrator is not a reason to see the queue or approve an export.

## Doors

| Door | Who |
|---|---|
| `GET /api/hidden-map/me` | members: open or not, "4 of 7", the village's words and dials |
| `GET /api/hidden-map/pins` | members: the map as `visiblePin` allows |
| `POST /api/hidden-map/pins` | members: log a pin; the same `clientId` twice writes once |
| `GET /api/hidden-map/pins/:id` | members who may read it in full, with its visits |
| `POST /api/hidden-map/pins/:id/photos` | the pin's owner |
| `POST /api/hidden-map/pins/:id/visits` | the owner, or an open member: photos, the stage seen, a note |
| `POST`, `DELETE /api/hidden-map/pins/:id/vouch` | an open member, or a keeper; never the owner |
| `POST /api/hidden-map/pins/:id/hide` | a member in a role that holds `hiddenmap.keep` |
| `GET /api/hidden-map/photos/:id` | whoever may read the pin; `?size=thumb` for the small one |
| `GET /api/hidden-map/vouch-queue` | an open member, or a keeper |
| `GET`, `POST /api/hidden-map/exports` | open members |
| `POST /api/hidden-map/exports/:id/approve`, `/decline` | an open member in a role that holds `hiddenmap.export`, never the asker |
| `POST /api/hidden-map/exports/:id/withdraw` | the asker |
| `GET /api/hidden-map/exports/:id/download` | the asker, once, after approval |
| `GET /api/hidden-map/access-log` | a keeper reads every row; a member reads their own |

## Photos

Every byte is re-encoded by `stripAndEncode` (`server/lib/placePhotos.ts`), which re-reads its own output and refuses
to store a file whose metadata survived, and is written through `writeToVolume`. Files live in
`DATA_DIR/hidden-map/`, beside the uploads directory and never inside it, because `/api/uploads/:filename` is
ungated. Names are 32 random hex characters. Answers are `Cache-Control: private, no-store`.

## Exports

Two people. An open member asks, at a chosen precision. A different open member in a role that holds `hiddenmap.export`
approves within `hiddenmap.export_hours` (default 24). The asker downloads once; the move from approved to downloaded
is a guarded update, so a second download finds nothing. The file is GeoJSON: no names, no owner, no photos, each
point at the coarser of the asked precision and the pin's own.

## The who-looked log

Every read of the shared map, every read of somebody else's pin, every queue read, vouch, hide, export step and log
read writes one row: who, what, when, and never where. A keeper reads who and what by first name, with no pin or
export id, so the log never puts a person beside a place. A member reads their own rows. Rows older than
`hiddenmap.access_log_days` (default 90) are deleted daily by the `hidden-map-sweep` job, which also lapses stale
export asks.

## What never carries hidden-map data

Event text, notifications and email, the village guide and every agent surface, the feedback relay, the knowledge
index (this doc is the module's contract and holds no pin), and server logs. Nothing here calls `recordEvent`.

## The basemap

`hiddenmap.basemap` is `none` (a grid of latitude and longitude, the default), `osm` or `esri-imagery`. Tiles load
on the member's own device straight from the provider, with the credit always on screen, and nothing is fetched to
the server, cached or served again, so no provider's caching term is touched. The provider does learn which tiles a
device asked for, so `hiddenmap.basemap_max_zoom` (default 13, about 5 km a tile) caps how close that is. Tile
addresses come from `tileUrl`, which refuses any part that is not a whole number in range, so a broken centre never
asks a provider for a picture of nowhere.

## A member's own data

The profile export carries their own pins (exactly where they are, since they are theirs), their visits and how many
photos they added. Erasure deletes their photos from the disk and the rows, their vouches, their opening, their log
rows and their open export asks, and leaves their pins and visits on the map with nobody attached.

## Dials

All in the `hiddenmap.*` namespace, all votable like every dial: `unlock_pins`, `vouches_per_pin`,
`default_precision`, `teaser`, `basemap`, `basemap_max_zoom`, `access_log_days`, `export_hours`, `visit_pay_days`,
`photo_max_mb`.
