# PlantSOS Mobile Transport Interface

The mobile interface accepts the same result payload over BLE or Wi-Fi.

## Wi-Fi mode

- ESP32 access-point address: `192.168.4.1`
- Serve the static web files at `http://192.168.4.1/`
- WebSocket endpoint: `ws://192.168.4.1/ws`
- Send one UTF-8 text result per WebSocket message, optionally terminated by a newline

## BLE mode

- Advertised name: `iGEM-Photometer`
- Service UUID: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- Notify characteristic: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`

## Accepted payloads

Compact CSV (analyte is required):

```text
A1,12.3,nM,OK,10516,SA
```

Version with sequence, signal, and analyte:

```text
42|A1|132.4|uM|OK|10516|SA
```

JSON:

```json
{"seq":42,"well":"A1","value":132.4,"unit":"uM","qc":"OK","signal":10516,"analyte":"SA"}
```

The device must generate a new `run` identifier at every boot. `seq` may restart within that new run, but should increase for each measurement in the run. `analyte` is required because the three assays share the same optical emission. The preferred payload also includes `plate`, `sample`, `date` or `recorded_at`, and `time_source`. If the instrument has no real clock, omit `ts`; the browser assigns the receive timestamp and includes it in CSV export. `concentration` is accepted only as a legacy alias for `value`.
