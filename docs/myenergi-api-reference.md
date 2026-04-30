# MyEnergi API Reference

Community-researched reference for the MyEnergi cloud API (`s{N}.myenergi.net`).
There is no official API documentation — everything here is derived from reverse-engineering
and community sources listed at the bottom.

---

## Authentication

**Method:** HTTP Digest Auth (realm `"MyEnergi Telemetry"`, algorithm MD5, qop `auth`)
- Username: hub serial number
- Password: app password (set in the MyEnergi app under Account → API / App password)

**Important:** This is a single credential with no permission scoping. Whoever holds it can
read all history and send any control command to any device on the hub. There is no read-only
key and no OAuth scope. See [Trust and Security](#trust-and-security) below.

---

## Server Discovery

MyEnergi routes each hub to an assigned server. Always resolve it before making data calls.

**Step 1 — hit the director:**
```
GET https://director.myenergi.net/<any-cgi-path>
```
Read the `X_MYENERGI-asn` response header. This header is present even on 401 responses.
Example value: `s18.myenergi.net`.

**Step 2 — use the assigned server:**
```
https://<asn>/<cgi-path>
```

**Watch every response** for a changed `X_MYENERGI-asn` header — if it differs from the current
base URL, switch immediately. Handle up to 3 redirects before erroring.

**Legacy heuristic (unreliable):** `s<last-digit-of-serial>.myenergi.net` — avoid for new code.

---

## Device Types and Prefixes

| Device | Description | URL prefix | Status letter |
|--------|-------------|------------|---------------|
| Eddi | Immersion/solar diverter | `E` | `E` |
| Zappi | EV charger | `Z` | `Z` |
| Harvi | Wireless CT clamp sensor | `H` | `H` |
| Libbi | Home battery | `L` | `L` |

---

## Status Endpoints (read-only)

All are `GET` requests using Digest Auth.

### All devices on hub

```
GET /cgi-jstatus-*
```

Returns a JSON array with one object per device type found on the hub, plus an
`{"asn": "sN.myenergi.net"}` object. This is the cheapest probe for credential validation
and the primary live-polling endpoint.

### Device-type or specific device

```
GET /cgi-jstatus-E          # all Eddis
GET /cgi-jstatus-E{serial}  # specific Eddi
GET /cgi-jstatus-Z          # all Zappis
GET /cgi-jstatus-Z{serial}  # specific Zappi
GET /cgi-jstatus-H          # all Harvis
GET /cgi-jstatus-H{serial}  # specific Harvi
GET /cgi-jstatus-L          # all Libbis
GET /cgi-jstatus-L{serial}  # specific Libbi
```

### Eddi status fields

| Field | Description |
|-------|-------------|
| `sno` | Serial number |
| `sta` | Status: 1=Paused, 3=Diverting, 4=Boost, 5=Max Temp Reached, 6=Stopped |
| `div` | Diversion watts (absent/zero when not diverting) |
| `gen` | Generated watts |
| `grd` | Grid watts (negative = exporting) |
| `che` | kWh transferred this session |
| `rbt` | Remaining boost seconds |
| `bsm` | 1 if manual boosting |
| `bst` | 1 if timed boosting |
| `hno` | Active heater (1 or 2) |
| `hpri` | Heater priority |
| `ht1`, `ht2` | Heater names |
| `tp1`, `tp2` | Temperature probe readings (°C; -1 if probe absent) |
| `vol` | Voltage × 10 (divide by 10 for volts) |
| `frq` | Supply frequency (Hz) |
| `ectp1`–`ectp3` | CT clamp power values (watts) |
| `ectt1`–`ectt3` | CT clamp names ("Grid", "Generation", etc.) |
| `ect1p`–`ect3p` | CT clamp phase assignments |
| `cmt` | Command timer: counts 1–10 while command in-flight, 254=success, 253=failure, 255=never received |
| `r1a`, `r2a`, `r2b` | Relay states (when relay board present) |
| `rbc` | Relay board connected (bool) |
| `hsk` | Heatsink temperature × 10 |
| `fwv` | Firmware version |
| `dat`, `tim` | Hub-local date/time (`DD-MM-YYYY` / `HH:MM:SS`) |
| `dst` | DST flag |
| `pri` | Device priority |

### Zappi status fields (key ones)

| Field | Description |
|-------|-------------|
| `zmo` | Charge mode: 1=Fast, 2=Eco, 3=Eco+, 4=Stopped |
| `pst` | Plug status: `A`=Disconnected, `B1`=Connected, `B2`=Waiting, `C1`=Ready, `C2`=Charging, `F`=Fault |
| `che` | kWh added this session |
| `mgl` | Minimum green level (%) |
| `lck` | Lock bits (see below) |
| `bsm` | Manual boost active |
| `bst` | Timed boost active |
| `bss` | Smart boost active |
| `tbk` | Manual boost kWh target |
| `sbk` | Smart boost kWh to add |
| `sbh`, `sbm` | Smart boost completion hour/minute |
| `pwm` | PWM duty cycle (divide by 100 for %) |
| `phaseSetting` | `"SINGLE_PHASE"`, `"THREE_PHASE"`, or `"AUTO"` |

**`lck` bit field:**

| Bit | Value | Meaning |
|-----|-------|---------|
| 0 | 1 | Locked now |
| 1 | 2 | Lock when plugged in |
| 2 | 4 | Lock when unplugged |
| 3 | 8 | Charge when locked |
| 4 | 16 | Charge session allowed (overrides lock) |

### Libbi status fields (additional)

| Field | Description |
|-------|-------------|
| `lmo` | Mode: `"BALANCE"`, `"STOP"`, `"DRAIN"` |
| `soc` | State of charge (%) |
| `mbc` | Battery capacity (Wh; divide by 1000 for kWh) |
| `mic` | Inverter capacity (W) |
| `pvDirectlyConnected` | bool |
| `bdp1` | Battery discharge power |
| `bcp1` | Battery charge power |
| `pvp1` | PV power |

### Harvi

Harvi has no control endpoints — it is a passive wireless CT clamp transmitter.
Status fields are limited to serial number, date/time, and CT readings (`ectp1`–`ectp3`).
Harvi does not appear in history endpoints.

---

## History Endpoints

### Minute-level history

```
GET /cgi-jday-{prefix}{serial}-{YYYY}-{M}-{D}
GET /cgi-jday-{prefix}{serial}-{YYYY}-{M}-{D}-{startHour}-{startMinute}-{numMinutes}
```

- Date parts are **not zero-padded** (month 6, not 06)
- `numMinutes`: use 1500 to safely cover DST fall-back days (25-hour days)
- The trailing time-window parameters allow fetching a partial day — useful for re-fetching
  just the tail of a day without pulling all 1440 records

**Response envelope:**
```json
{ "U{serial}": [ { ...record }, ... ] }
```

**Per-minute record fields:**

| Field | Description | Unit |
|-------|-------------|------|
| `yr`, `mon`, `dom`, `dow` | Date parts | — |
| `hr` | Hour (absent on all records in hour 0 — treat as 0) | 0–23 |
| `min` | Minute (absent on the first record of each hour — treat as 0) | 0–59 |
| `imp` | Grid imported energy | Joules |
| `exp` | Exported energy | Joules |
| `gep` | Generated (PV) energy | Joules |
| `h1d`, `h2d` | Heater 1/2 diverted energy | Joules |
| `h1b`, `h2b` | Heater 1/2 boost energy | Joules |
| `v1` | Voltage × 10 | — |
| `frq` | Frequency × 100 | — |
| `pect1`–`pect6` | Positive CT energy | Joules |
| `nect1`–`nect6` | Negative CT energy | Joules |

**Converting Joules to kWh:** divide by 3,600,000.
**Converting Joules to average watts (per-minute):** divide by 60.

**Critical quirks:**
- **Zero-suppression:** fields with value zero are entirely absent from the JSON. Treat any
  missing numeric field as zero.
- **`min` missing on first record of each hour:** this is an API bug. The record represents
  minute 0 but the key is absent. Treat it as minute 0.
- **`hr` missing on all records in hour 0:** same pattern. Treat as hour 0.
- **One calendar day per request, always.** There is no multi-day batch endpoint.
  Every known client implementation loops day-by-day.
- **Each call takes ~2–10 seconds** server-side. This is a performance characteristic,
  not a rate limit.

### Hourly history

```
GET /cgi-jdayhour-{prefix}{serial}-{YYYY}-{M}-{D}
GET /cgi-jdayhour-{prefix}{serial}-{YYYY}-{M}-{D}-{startHour}-{numHours}
```

Returns 24 records (one per hour) with the same field set but no `min` field.
Suitable for coarser range views without the per-minute data volume.

---

## Control Endpoints

> **Note:** All control endpoints use `GET` (not `POST`). This is how the API works — there is
> no request body. Control responses return `{"status": 0, "statustext": ""}` on success.

### Command acknowledgement

After sending any control command, poll `cmt` in subsequent status calls:
- 1–10: hub is relaying command to device
- 254: success
- 253: failure
- 255: never received

The hub queues one command at a time. Sending a second command while the first is in-flight
returns error code 26 (Busy).

### Eddi control

#### Start manual boost
```
GET /cgi-eddi-boost-E{serial}-10-{target}-{minutes}
```
- `target`: 1=Heater 1, 2=Heater 2, 11=Relay 1, 12=Relay 2
- `minutes`: 1–240

#### Cancel boost
```
GET /cgi-eddi-boost-E{serial}-1-{target}-0
```

#### Set operating mode
```
GET /cgi-eddi-mode-E{serial}-{mode}
```
- `0`=Stopped, `1`=Normal

#### Read/set heater priority
```
GET /cgi-set-heater-priority-E{serial}
```
Returns `{"hpri": 1, "cpm": 15}`. The `cpm` value **must** be echoed in the write call:
```
GET /cgi-set-heater-priority-E{serial}-{heater}-{cpm}
```

#### Read timed boost schedule
```
GET /cgi-boost-time-E{serial}
```
Returns 8 slots: slots 11–14 for Heater 1, slots 21–24 for Heater 2.

#### Set timed boost schedule slot
```
GET /cgi-boost-time-E{serial}-{slot}-{startMinutes}-{durationMinutes}-{daySpec}
```
- `startMinutes` = `hours × 60 + minutes`
- `daySpec`: 8-char string, characters 1–7 = Monday–Sunday (character 0 is always 0)

#### Set priority
```
GET /cgi-set-priority-E{serial}-{priority}
```

### Zappi control

#### Set charge mode
```
GET /cgi-zappi-mode-Z{serial}-{mode}-0-0-0000
```
- `mode`: 1=Fast, 2=Eco, 3=Eco+, 4=Stop

#### Start manual boost
```
GET /cgi-zappi-mode-Z{serial}-0-10-{kWh}-0000
```

#### Start smart boost (complete by time)
```
GET /cgi-zappi-mode-Z{serial}-0-11-{kWh}-{HHMM}
```
- `HHMM`: 4-digit target completion time, e.g. `1400` = 2pm

#### Stop boost
```
GET /cgi-zappi-mode-Z{serial}-0-2-0-0000
```

#### Set minimum green level
```
GET /cgi-set-min-green-Z{serial}-{percentage}
```

#### Set phase setting
```
GET /cgi-zappi-phase-setting-Z{serial}-{setting}
```
- `0`=Single phase, `1`=Three phase, `2`=Auto

#### Read/set timed boost schedule
```
GET /cgi-boost-time-Z{serial}
GET /cgi-boost-time-Z{serial}-{slot}-{HHMM_start}-{HdMm_duration}-{daySpec}
```
- Slots 11–14
- `daySpec`: same 8-char format as Eddi

#### Unlock / allow charge session
```
GET /cgi-jlock-{serial}-00000010
```
The 8-char binary string maps directly to the `lck` bit field.

### Libbi control

#### Via Digest Auth (hub serial + app password)

```
GET /cgi-libbi-mode-L{serial}-{mode}
```
- `0`=Stop, `1`=Normal (Balance), `5`=Drain (Export)

#### Via OAuth (separate auth flow)

Charge-from-grid and charge target require a Bearer token from AWS Cognito:
- Pool ID: `eu-west-2_E57cCJB20`
- Client ID: `2fup0dhufn5vurmprjkj599041`
- Base URL: `https://myaccount.myenergi.com`

```
GET  /api/AccountAccess/LibbiMode?serialNo={serial}
PUT  /api/AccountAccess/LibbiMode?chargeFromGrid={true|false}&serialNo={serial}
GET  /api/AccountAccess/{serial}/LibbiChargeSetup
PUT  /api/AccountAccess/{serial}/TargetEnergy?targetEnergy={wh}
```
`targetEnergy` is in Wh. For a 10 kWh battery, 100% = 9200 Wh.

---

## App Key Store

Named key-value pairs stored on the hub (site name, device names, etc.).

```
GET /cgi-get-app-key-              # all keys
GET /cgi-get-app-key-{key}         # specific key
GET /cgi-set-app-key-{key}={value} # set a key
```

Example keys: `siteName`, device display names. Useful for showing the user's own naming in a UI.

---

## Rate Limits

**There are none published.** MyEnergi has never documented any throttling policy.
No community reports of 429 errors exist in any of the major open-source integrations
(Home Assistant, pymyenergi, mec).

Community guidance: the API is tolerant of normal polling and day-by-day backfill loops,
but "don't abuse it" — if misused, MyEnergi could throttle or revoke access without notice.
A conservative 1–2 second delay between backfill calls is sensible defensive practice.

**Practical backfill speed:** ~2–10 seconds per day (server-side; not a rate limit).
One calendar day per API call is the hard constraint — there is no batch endpoint.

---

## Error / Response Code Reference

Control responses return a `status` field. Negative values indicate errors (the negative
of the code below).

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Invalid ID |
| 3 | No action taken |
| 4 | Hub not found |
| 5 | Internal error |
| 6 | Invalid load value |
| 12 | User not authorised |
| 13 | Serial number not found |
| 14 | Missing or bad parameter |
| 21 | Slot missing or invalid |
| 22 | Priority bad or missing |
| 23 | Command not appropriate for device |
| 25 | Minimum green level bad or missing |
| 26 | Busy — hub already sending a command to device |
| 27 | Relay not fitted |

---

## Trust and Security

The MyEnergi API has **no permission scoping**. A single credential (hub serial + app password)
grants full read and write access to every device on the hub — history, status, and all control
operations. There is no read-only key and no OAuth scope mechanism.

**Implications for this app:**
- Storing user credentials carries significant responsibility. A breach would expose not just
  data but the ability to control users' hardware.
- Never store the raw app password in the database. Keep it in a secrets manager; store only
  a reference (as `credentialRef` in `provider_connections`).
- Only implement read operations unless there is a clear product need for control. A no-control
  policy limits blast radius if credentials are ever compromised.
- Be explicit with users at onboarding: tell them what credentials are being requested and that
  those credentials technically allow full control of their installation.
- Users can revoke access at any time by rotating their app password in the MyEnergi portal.
- The MyEnergi app allows setting a dedicated API/app password separate from the main account
  password — encourage users to do this rather than sharing their primary password.

This limitation is inherent to the MyEnergi ecosystem — every third-party integration
(Home Assistant, pymyenergi, etc.) faces the same constraint.

---

## Sources

- [twonk/MyEnergi-App-Api](https://github.com/twonk/MyEnergi-App-Api) — primary reverse-engineered API reference; canonical field documentation
- [CJNE/pymyenergi](https://github.com/CJNE/pymyenergi) — Python client library (connection.py, base_device.py, zappi.py, eddi.py, libbi.py)
- [CJNE/ha-myenergi](https://github.com/CJNE/ha-myenergi) — Home Assistant integration; absence of rate-limit issues is itself informative
- [ashleypittman/mec](https://github.com/ashleypittman/mec) — full error code table, ZSH state codes, Zappi/Eddi control patterns
- [bisand/myenergi-api](https://github.com/bisand/myenergi-api) — TypeScript client; confirms cgi-get-app-key / cgi-set-app-key
- [myenergi.info — server redirects](https://myenergi.info/update-to-active-server-redirects-t2980.html)
- [myenergi.info — rate limits](https://myenergi.info/data-frequency-request-frequency-t5905.html)
- [myenergi.info — week/month history](https://myenergi.info/week-and-month-history-t2056.html)
- [myenergi.info — jday/jdayhour field analysis](https://myenergi.info/investigating-the-jday-and-jdayhour-apis-t881.html)
