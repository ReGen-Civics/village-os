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

- **S2:** the page at `/hidden-map` (Village menu, and a phone shortcut): log a place with photos, the location
  read from the photo on the device and the photo re-encoded before it leaves, the cover tool for faces, the map
  with its layers, a pin's detail with vouching and return visits, the vouch queue, and asking for and approving a
  copy.

- **S3:** return visits open a claim on the quest the village names (`returnVisitQuestId`), described below.

Not built yet:
- S4: capture with no signal (an IndexedDB outbox).
- S5 (optional): seed origins from the library.

## Setup

1. Put somebody in a role that holds `hiddenmap.keep` (and, for exports, a second person in a role that holds
   `hiddenmap.export`). On day one nobody's map is open, so the keeper is who vouches the first members through.
2. Choose what the map is drawn on (`hiddenmap.basemap`). The default is a plain grid, which sends nothing anywhere.
3. Optionally name the map, rename the layers, change the kinds, or open a layer to every member (module settings:
   `title`, `labels`, `kinds`, `openLayers`).

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

## On the device

- **The location is read before the photo is touched.** `shared/exifGps.ts` reads the GPS position out of the
  original JPEG in the browser and fills the pin. Nothing is sent yet.
- **The photo is re-encoded on the device** (`client/src/lib/hiddenMapPhoto.ts`): drawn onto a canvas and encoded
  again, so it carries no location, camera or time. It never hands back the original file; a browser that cannot
  re-encode gets a refusal. The server strips it again and proves it (above).
- **Faces: a cover tool and a prompt, by choice.** No on-device face detector is reliable in the browsers members
  carry, and a bundled model is a new dependency against a full budget that still misses faces in profile. So the
  capture screen asks "Faces, number plates or anything that says who was there?" and a dragged box is pixelated in
  blocks of at least a twelfth of its short side before the re-encode. A crop trims the edges the same way.
- **Photos are read with the member's token** and shown from memory. An `<img src>` cannot carry a token, and these
  photos are never public.
- **The map is our own** (`client/src/components/hiddenMap/WorldMap.tsx`): tiles placed by Web Mercator arithmetic,
  or a plain grid. No map library, no new dependency, no change to the content security policy.

## Return visits that pay

Name a quest in the module's settings (`returnVisitQuestId`), and give it whatever reward the village chooses. A
return visit by an open member to somebody else's pin then opens a claim on that quest and submits it, at most once
per pin per `hiddenmap.visit_pay_days` (default 30). That is the whole of it (`server/lib/hiddenMapQuest.ts`):

- **No new money path.** The claim completes through the ordinary consent route, which refuses a member consenting
  their own work, and the village's `quest.completed` rule pays it.
- **The quest's own gate runs first** (closed, stage, role, safety), and `openClaim` takes the quest's row lock, so a
  member holding an open claim gets no second one until that one is decided.
- **The claim names a day, never a place**, because whoever consents quests may not be somebody whose map has opened.
- The owner's own visits and visits by members whose map is closed open nothing. The visit itself always stands.
