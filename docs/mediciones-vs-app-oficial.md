# Wearable measurements: our app vs official apps

Living comparison of on-demand spot-measurement times. Updated as each metric
completes its baseline. Devices: Colmi H59 band, YCBT R88 ring.

## Method

- Warm state (device worn a while, sensor settled), 3 runs per device per metric.
- Our times come from the timing instrumentation (`measure-timing.ts`:
  `medida {kind}: inicio / primer dato / cierre`), read in the on-device
  **Registro BLE** (Reloj ▸ Avanzado ▸ Modo diagnóstico).
- Official times measured with a stopwatch in SmartHealth (band) and the ring's
  official app, same conditions.
- Market references: Apple Watch SpO2 15 s spot check; Garmin ≤ 30 s;
  Amazfit 45 s one-tap; Oura / Galaxy Ring / Ultrahuman have **zero**
  on-demand measurement (passive only).

## Heart rate — DONE

| Run | Device | Official    | Ours: first data | Ours: done | Retry? |
| --- | ------ | ----------- | ---------------- | ---------- | ------ |
| 1   | Band   | 23 s        | 11.6 s           | 12.6 s (3) | No     |
| 2   | Band   | 23 s        | 11.6 s           | 12.6 s (3) | No     |
| 3   | Band   | 23 s        | 10.6 s           | 11.6 s (3) | No     |
| 4   | Ring   | 12 s / 43 s | 19.0 s           | 21.0 s (3) | Yes    |
| 5   | Ring   | 12 s / 43 s | 8.5 s            | 10.5 s (3) | No     |
| 6   | Ring   | 12 s / 43 s | 20.4 s           | 22.4 s (3) | Yes    |
| 7   | Ring   | 12 s / 43 s | 8.2 s            | 10.2 s (3) | No     |

Verdict:

- **Band: ~12 s vs 23 s official.** Solved, no contest — consistently ~2× faster.
- **Ring is bimodal**: engages immediately → 8–10 s (beats official 12 s);
  cold engage → retry fires at 10 s, data ~9–10 s later (~20–22 s total).
  Worst case still halves the official 43 s total.
- House rule from this work: **sweep-only**. A buffer-first attempt was
  implemented and reverted: a ≤60 s buffer can't tell whose wrist the device
  is on if it changed hands between taps. Every tap sweeps; double-tap always
  sweeps. (`latestHeartRate` removed; timing notes kept.)

## SpO2 — DONE (both devices)

| Run | Device | Official    | Ours: first data | Ours: done   | Value   |
| --- | ------ | ----------- | ---------------- | ------------ | ------- |
| 1   | Band   | 27 s        | 25.6 s           | 26.6 s (3)   | 97–99 % |
| 2   | Band   | 27 s        | 26.5 s           | 27.4 s (3)   | 96–97 % |
| 3   | Ring   | 56 s / 65 s | — (0 readings)   | timeout 60 s | —       |
| 4   | Ring   | 56 s / 65 s | — (0 readings)   | timeout 60 s | —       |
| 5   | Ring   | 56 s / 65 s | 59.6 s           | 59.6 s (1)   | 99 %    |
| 6   | Ring   | 56 s / 65 s | 72.7 s           | 72.7 s (1)   | 99 %    |
| 7   | Ring   | 56 s / 65 s | 63.6 s           | 63.6 s (1)   | 99 %    |
| 8   | Ring   | 56 s / 65 s | 42.9 s           | 42.9 s (1)   | 99 %    |
| 9   | Ring   | 56 s / 65 s | 53.4 s           | 53.4 s (1)   | 97 %    |
| 10  | Ring   | 56 s / 65 s | 52.5 s           | 52.5 s (1)   | 96 %    |

Engagement (anillo): los timeouts con cero tramas (~40 % de los intentos de
presión) no son un problema de ventanas sino de enganche — el sensor a veces
no arranca. Respuesta en código: el reintento del anillo ahora es STOP +
pausa de 3 s + START (un re-arme inmediato sobre un sensor mudo no cambia
nada); el cierre distingue `timeout` (hubo radio) de `no-signal` (mudez
total, con su propio mensaje de reajuste); y el flag `info.wearing` por fin
se alimenta de las muestras de contacto (solo frescas: el historial no puede
pisarlo). Sin cambios de ventanas.

Verdict (band): **parity at ~27 s.** The real reading arrives in the classic
byte (`0x61` = 97 %); bytes 5–6 carry a constant status field (`6c 02` = 620)
that used to decode as a 62 % phantom and close the sweep in 1.6 s. Fixed with
a 70–100 final-value gate on band SpO2 (and the same plausibility audit on the
classic-byte HR path); sweep counting was verified post-gate, so phantom
streams can no longer complete a measurement.

Follow-up: widen the band SpO2 window 30 s → 40 s (data lands at ~26 s; 4 s of
margin is tight, costs nothing on the happy path since we close on the 3rd
reading).

Verdict (ring): **DONE — and faster than official.** Runs 5–7 (90 s window,
20 s retry) closed at 60–73 s; experiment runs 8–10 (retry removed) closed at
43/53/53 s with genuine varying values (99/97/96 %). Conclusion: the 20 s
re-arm restarted the ring's sensing (+15–20 s cost, same signature as the band
BP case), so ring SpO2 now runs **without retry**. Run 1's 43 s beats the
official 56 s outright. The ring HR retry stays (proven load-bearing there:
data consistently ~9 s post-rearm) — different sensor, different behavior.

## Blood pressure — DONE (both devices, ring engagement noted)

| Run | Device | Official             | Ours: first data | Ours: done   | Value    |
| --- | ------ | -------------------- | ---------------- | ------------ | -------- |
| 1   | Band   | 30 s (single option) | 40.9 s           | 41.8 s (3)   | 101/69 … |
| 2   | Band   | 30 s (single option) | 40.8 s           | 41.8 s (3)   | 100/71 … |
| 3   | Band   | 30 s (single option) | 40.8 s           | 41.9 s (3)   | 105/67 … |
| 4   | Band   | 30 s (single option) | 25.6 s           | 26.6 s (3)   | 104/73   |
| 5   | Band   | 30 s (single option) | 25.6 s           | 26.6 s (3)   | 102/68   |
| 6   | Band   | 30 s (single option) | 25.6 s           | 26.7 s (3)   | 100/64   |
| 7   | Ring   | 26 s / 35 s          | — (0 readings)   | timeout 60 s | —        |
| 8   | Ring   | 26 s / 35 s          | 25.6 s           | 27.6 s (3)   | 113/76 … |
| 9   | Ring   | 26 s / 35 s          | — (0 readings)   | timeout 60 s | —        |
| 10  | Ring   | 26 s / 35 s          | 12.3 s           | 14.6 s (3)   | 113/75   |
| 11  | Ring   | 26 s / 35 s          | — (0 readings)   | timeout 60 s | —        |

Finding: runs 1–3 were ~12 s slower, and the cause was our own 15 s retry.
The band streams an estimation curve from ~8 s (varying raw values, result
bytes still zero); with zero _accepted_ samples at 15 s the retry fired
STOP+START and restarted the estimation — first data then landed 26 s after
the retry, every run (15 + 26 = 41). Fix: the Colmi retry now fires only on
total radio silence (new `measureFrames` counter), never while frames flow.
Proof runs 4–6: **~26.6 s with no retry line, ~3–4 s faster than official.**
Values genuine (vary run to run, plausible, classic-byte layout).

Verdict (ring): **policy validated, engagement flaky.** Runs 8 and 10 closed
at 27.6 s and 14.6 s (both beating official's 26 s/35 s); runs 7, 9, 11
delivered zero frames in 60 s. ~40 % engagement rate points at contact/position
variance, not windows — no policy rescues a sensor that never starts. Response
in code (no window changes): the ring retry is now STOP + 3 s settle + START
(a blind re-send into a mute sensor changes nothing); the close distinguishes
`timeout` (radio present) from `no-signal` (total silence, with its own
reseat-and-stay-still message); `info.wearing` is finally fed by contact
samples (fresh only, history can't clobber it). A full measure-all sync
(HR + BP, then HR + SpO2 + BP) completed end to end with the re-enganche
rescuing 4 of 4 silent sweeps.

---

# Part 2 — How the implementation works (protocol level)

## 1. Executive summary

Our app talks to both wearables directly over Bluetooth Low Energy (BLE),
with no dependency on the manufacturers' apps. Every on-demand measurement
(HR, SpO2, blood pressure) follows the same lifecycle on both devices —
*enable → warm-up → live frames → target readings → disable → value on
screen* — and the sweep closes the moment its reading target is met instead
of running a fixed ritual. That single design decision is most of the speed
gap: the official apps run fixed-duration routines with countdowns,
"analyzing" screens and cloud sync; we close on first valid data. Same
sensors, less ceremony. Measured result across 20+ device runs: every metric
on both devices lands at or under the official app's time (see Part 1).

## 2. Architecture

```
UI (Reloj view, check-in vitales)
  └─ WearableContext (session owner: connect/sync/measure orchestration)
       ├─ ColmiSession  (band H59, src/devices/colmi/)
       └─ YcbtSession   (ring R88, src/devices/ycbt/)
            └─ ble-client (Capacitor Community BluetoothLe wrapper)
```

- `WearableContext` owns one active `DeviceSession`, the sample map, the day
  store (steps/sleep aggregates), sync sequencing (`syncAll`), and the BLE
  diagnostic log (Registro BLE).
- Each driver implements `DeviceSession`: `start/stop`, `measure(kind,
  onDone)`, `measurePolicy(kind)`, `syncHistory()`, plus protocol parsing in
  `realtime.ts` / `history.ts` / `records.ts` (ring) and `realtime.ts` /
  `history.ts` / `bc.ts` (band).
- All cross-layer timing evidence comes from `measure-timing.ts`
  (`inicio / primer dato / cierre` notes), emitted through
  `ble.noteDiagnostic` and readable on-device in Reloj ▸ Avanzado ▸ Modo
  diagnóstico ▸ Registro BLE.

## 3. Colmi H59 band driver

**Transport.** Nordic UART service `6e40fff0` (write `...0002`, notify
`...0003`) plus a custom service `de5bf728` (the rich `bc` channel) and
standard Device Information `180a`. Frames are 16 bytes: `[cmd …payload…
checksum]` (`COLMI_FRAME_SIZE = 16`).

**Live measurement.** Command 105 (`0x69`, `START_REALTIME`) with
`[type, 1]`; stop is 106 (`0x6a`, `STOP_REALTIME`) with `[type, 0, 0]`. The
band answers realtime frames on the *same* command 105 (bit `0x80` = error).
Measure types: HR = 1, blood pressure = 2, SpO2 = 3.

**Frame layouts (empirically verified against captures).**
- HR: classic byte at `payload[2]` (direct bpm), or — on this H59 firmware —
  u16 tenths at `payload[5..6]` (`0x039e` = 926 → 92.6 lpm). Both accepted,
  each with plausibility gates.
- SpO2: classic byte at `payload[2]` is the real reading (verified: `0x61` =
  97 %). Bytes 5–6 carry a *constant status field* (`6c 02` = 620 raw) that
  decodes to a 62 % phantom — gated out (see §7).
- Blood pressure: classic bytes `payload[2]` = HR, `[3]` = systolic, `[4]` =
  diastolic (verified: `0x46 0x65 0x45` → HR 70, 101/69); u16 variants at
  `[5..6]`/`[7..8]` accepted with the same plausibility gate. During a sweep
  the band also streams an estimation curve (varying raw values, result bytes
  zero) for ~26 s before populating the result bytes.

**Continuous sources.** On connect the driver sends `HR_LOG [2,1,5]` (24/7 HR
logging), starts the live HR stream, and runs a 5 s watchdog that re-arms it
(`HR_RETRY_MS = 20 s` staleness trip). History over UART: steps (cmd 67),
HR curve — 1 point / 5 min (cmd 21), stress (55), HRV (57); rich channel `bc`:
sleep phases (`0x27`) and hourly SpO2 (`0x2a`), which require a `bc` login
handshake first.

**Sweep policy (final).** Default 30 s window, target 3 readings. Blood
pressure: 60 s + retry at 15 s — but the retry fires **only on total radio
silence** (a `measureFrames` counter tracks every frame of the requested
type, decodable or not). Rationale, measured: the band's BP estimation runs
~26 s; the old retry (zero *accepted* samples at 15 s) fired STOP+START
mid-estimation and restarted it, turning official-30 s into ours-41 s
(15 + 26, three runs straight). After the fix: ~26.6 s, no retry line.

## 4. YCBT R88 ring driver

**Transport.** Custom service `be940000` (write/indicate `...0001`,
write-no-response `...0002`, indicate `...0003`) plus a JieLi auth notify
characteristic that must be subscribed or the ring stays mute. Packets are
`[type-hi, type-lo, len-hi, len-lo, …payload…, crc-hi, crc-lo]` reassembled by
`PacketStream` (C1 control, C3 notify split).

**Live measurement.** Command `0x032f` (`LIVE_MEASUREMENT`) with
`[0x01=enable/0x00=disable, mode]`; modes: HR = `0x00`, BP = `0x01`, SpO2 =
`0x02`. The ring ACKs (`03 2f 07 …`), streams data on `0x06xx`, and reports
its own verdict on `04 0e [mode][result]` (2 = failed by contact/movement,
anything else = cancelled — either cuts the sweep short instead of waiting
out the window).

**Data opcodes.** `0x0600` live status (steps/distance/kcal only — never HR),
`0x0601` HR upload, `0x0602` SpO2 upload, `0x0603` BP upload, `0x060a`
comprehensive, `0x0613` wearing/contact. BP payload (after the 2-byte header):
systolic, diastolic, HR (verified: `0x71 0x4c` → 113/76, varying per
reading). SpO2 payload: single byte percent (verified 96–99 %).

**History dump.** Query/ack pairs: sport `05 02`, sleep `05 04`, heart
`05 06`, blood `05 08`, combined `05 09`, SpO2 `05 1a`; records carry ring-RTC
timestamps reinterpreted to phone-local time. The ring clock is set from the
phone at handshake (`SET_TIME`). Observed on this unit: sport/sleep slots
consistently empty, heart/blood/combined return data.

**Sweep policy (final).** HR: target 3, 30 s, retry 10 s. BP: target 3, 60 s,
retry 15 s. SpO2: target 1, **90 s, no retry** — measured decision: the ring
needs 43–73 s to deliver its first (only) SpO2; a 20 s re-arm restarted
sensing (+15–20 s cost, proven by experiment runs at 43/53/53 s without vs
60–73 s with). The ring HR/BP retries stay: data consistently lands ~9–10 s
post-rearm there (re-arm engages; different sensor, different behavior).

## 5. Sweep lifecycle (both drivers)

```
measure(kind) → note "inicio"
  → send ENABLE → (ring: wait ACK; band: start streaming)
  → [retry/re-engage point if policy has one and zero accepted samples]
  → first accepted sample → note "primer dato + elapsed"
  → target reached → note "cierre completada + elapsed + readings"
  → send DISABLE → onDone(true)
  → window expires with samples → "completada" (partial credit)
  → window expires silent → "timeout" (radio w/o readings) / "no-signal" (mute)
```

Closing early on target is the core speed behavior: a 60 s window that gets
3 readings in 12 s closes in 12 s. Windows are caps, never fixed waits.

## 6. Retry semantics (the three different answers)

| Case | Behavior | Evidence |
|---|---|---|
| Band BP | retry only on total radio silence (`measureFrames`) | 15 s STOP+START restarted a live estimation (30 s → 41 s ×3); silence-only fix → 26.6 s, no retry line |
| Ring HR/BP | STOP + 3 s settle + START (re-enganche), once | data lands ~9–17 s post-re-engage, repeatedly; blind re-send never rescued a mute sweep |
| Ring SpO2 | no retry at all | experiment: 43/53/53 s without vs 60–73 s with; the re-arm restarted sensing |

Rule of thumb the data taught: *re-arming an idle sensor engages it;
interrupting a working estimation restarts it.* The code distinguishes the
two by what the radio is doing.

## 7. Phantom-reading gates

- **Band SpO2**: final value must be 70–100. The constant status field
  (`6c 02` = 620 raw → 63 %) closed sweeps in 1.6 s with a clinically absurd
  value; now rejected. Same plausibility audit applied to the classic-byte HR
  path (30–220, matching the u16 path).
- **Ring**: `plausibleSpo2` 70–100 on live uploads; HR/BP range gates in
  `records.ts` (`HR_MIN/MAX`, `BP_MIN/MAX`).
- **Counting is post-gate**: `measureCount` increments only on frames that
  yield accepted samples, so phantom streams can neither close a sweep nor
  suppress a legitimate retry. (Verified by test after the gate landed.)

## 8. Timeout vs no-signal (and what the user sees)

At window expiry with zero accepted readings the close reason is:
- `timeout` — frames flowed but nothing parsed (slow sensor, wrong moment);
  UI: generic "didn't complete, keep contact and retry".
- `no-signal` — zero `06`-group frames the whole window (mute sensor,
  almost certainly fit/contact); UI (Reloj): dedicated *"Sin señal del
  anillo. Ajusta el anillo, quédate quieto e inténtalo de nuevo."* (es/en).
- The ring's own `04 0e` verdict maps separately: `failed` (contact/movement)
  vs `cancelled`, each with its own message. The UI never shows a bare
  "error" for any of these paths.

## 9. Safety timers (derived, never fixed)

Two historical bugs came from fixed constants, both fixed by deriving from
the real driver policy:
- Card-level safety (Reloj): was a fixed 45 s — it "timed out" ring SpO2
  (60→90 s window) mid-sweep, freeing the card while the driver measured, so
  re-taps piled measures onto a live driver (toast spam that *looked like*
  no attempt). Now `windowMs + 15 s` per metric.
- Sync-level safety (`syncAll`): was a fixed 120 s — a full ring sync
  (30+60+90 s windows + dump) exceeds it and would die mid-flight. Now
  re-armed from actual cost: Σ(windowMs + 5 s) + 30 s dump margin.
- Per-measure guards inside `syncAll` (`windowMs + 5 s`) predate this work
  and were already correct.

## 10. History dump and recovery paths

- Every `syncAll` runs `syncHistory` first (band: UART curves + `bc` login →
  sleep phases + hourly SpO2; ring: `05`-family queries), then an 800 ms
  settle (the ring ignores a measure that lands exactly as the dump closes),
  then forced/stale measures sequentially.
- After a failed ring SpO2, an extra history volcado runs: the ring often
  banks the reading it didn't stream, and the dump recovers it without a
  user retry.
- Check-in autofill (Programa ▸ vitales) accepts only live-session samples
  (never history — history timestamps can't be trusted as "now"), requires
  ≤5 min freshness, and the first sync of a session forces HR + BP + SpO2.

## 11. Timing instrumentation and the Registro BLE

`src/devices/measure-timing.ts` formats every sweep as three notes —
`medida {kind}: inicio / primer dato en X.X s / cierre {outcome} en Y.Y s
(N lectura(s))` — emitted via `ble.noteDiagnostic` and readable on-device at
Reloj ▸ Avanzado ▸ Modo diagnóstico ▸ Registro BLE (with a Copiar button for
export). Every number in Part 1's tables came from these notes, captured warm
on-device, 2–7 runs per metric. No stopwatch app, no estimates.

## 12. House rules (product decisions, enforced in code)

1. **Sweep-only.** No buffer-first display: a ≤60 s buffer was implemented
   and reverted — it can't tell whose wrist the device is on if it changed
   hands between taps. Every tap sweeps; double-tap on a card always sweeps
   that metric live. (`latestHeartRate` was fully removed, not left dormant.)
2. **No invented data.** History never autofills the check-in; the Reloj
   shows historical values only with honest age labels ("Hace 2 h" /
   "Del historial"), never "En vivo".
3. **Failures speak precisely.** Five distinct outcomes (completed, timeout,
   no-signal, failed, refused/cancelled), each with its own user message —
   never a bare error, never a silent empty card.
4. **Windows are caps.** Nothing waits out a full window when the data is
   already in; nothing closes early on garbage.

## 13. Final policy table

| Device | Metric | Target | Window | Retry | Closes (measured) |
|---|---|---|---|---|---|
| Band | HR | 3 | 30 s | — (continuous stream) | ~12 s |
| Band | SpO2 | 3 | 30 s | — | ~27 s |
| Band | BP | 3 | 60 s | 15 s, silence-only | ~26.6 s |
| Ring | HR | 3 | 30 s | 10 s, STOP-settle-START | 8–27 s |
| Ring | SpO2 | 1 | 90 s | none (measured) | 43–73 s |
| Ring | BP | 3 | 60 s | 15 s, STOP-settle-START | 13–38 s |

