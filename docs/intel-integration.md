# Utopia Intel integration

The `/intel` page reads data live using the configured server-side intel account.
`UTOPIA_INTEL_USERNAME` and `UTOPIA_INTEL_PASSWORD` belong in `.env.local` for local
use and hosting environment secrets for deployment. Neither has a `NEXT_PUBLIC_`
prefix. Authentication tokens are kept in server memory and renewed when needed.

## Data lifecycle

Each section visit, target change, form submission or refresh
starts a new request. Upstream requests use `cache: no-store`; API responses use
`Cache-Control: private, no-store`. No polling, snapshots or background imports
are used. Table search, sorting and pagination operate on the current response.
Changing targets cancels the old browser request and hides its data immediately.
The URL preserves the active section, server, side and enemy coordinates for a
browser reload or shared link. A live fetch retrieves existing reports; it does
not collect new in-game intel.

## Endpoint inventory

These paths were found in the official site's currently served frontend bundle
`main.6e4fbc1e.js` and verified with the configured account on World of Legends.
Availability on other kingdoms depends on account permissions. This site supports World of Legends only.

| Local resource | Upstream request | Interface |
| --- | --- | --- |
| `GET /api/kingdom-intel?side=own` | `GET Kingdom/v1/OwnKingdom?server=…` | Own province dashboard |
| `GET /api/kingdom-intel?side=enemy&location=5:11` | `GET Kingdom/v1/EnemyKingdom?server=…&location=…` | Editable enemy dashboard |
| `GET /api/intel-data?resource=recent` | `GET Kingdom/v1/Recent?server=…` | Recent province reports |
| `resource=archive&side=own&slot=1` | `GET Province/v1/SotArchive?server=…&location=…&slot=…` | Province throne history |
| `resource=war-plan&side=enemy` | `GET WarPlan/v1/Get?server=…&location=…` | View-only saved plans |
| `resource=search` | `POST Kingdom/v1/Search` | Kingdom size search |
| `resource=history` | `POST Kingdom/v1/Ticks` | Kingdom land/networth/honor history |
| `resource=races` | `GET Data/v1/RaceCombos/{server}` | Race/personality attributes |
| `resource=ticks` | `GET Data/v1/Ticks` | Game tick calendar |

All local resources accept only `server=1` (World of Legends) and `location=kingdom:island`. Location defaults to `5:11`. Own-side archives and
plans resolve the account's actual kingdom on every request. Kingdom history
compares the own kingdom with the selected enemy. Search defaults to current
own-kingdom totals unless explicit `acres`, `networth` and `provinces` are supplied.
History accepts `numberTicks` (1–288) and optional `tickId` (0–4000). Archives
accept `slot` (1–25). Missing archive/plan responses (404) display as no data;
access failures display an error. Complete responses remain available as JSON.
The original no-side `/api/kingdom-intel` combined response remains supported.

Search and historical reads use POST upstream because the official API requires
it; they do not modify game data. No operations, users, news or war-plan write
endpoints are exposed. This inventory covers observed frontend data requests,
not an assertion that every possible undocumented endpoint has been discovered.

## Validation

Run `node --test tests/intel-api.cjs tests/intel-live.cjs` and `npm run build`.
The API tests mock network responses and do not contact the game or load real
credentials. Live endpoint checks are performed separately with the local site.
On this Windows machine, Node needs the Windows trusted-root CA bundle supplied
through `NODE_EXTRA_CA_CERTS`; do not disable TLS verification.
