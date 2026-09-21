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

Compact CSV:

```text
A1,12.3,nM,OK
```

Version with sequence, signal, and analyte:

```text
42|A1|132.4|uM|OK|10516|SA
```

JSON:

```json
{"seq":42,"well":"A1","concentration":132.4,"unit":"uM","qc":"OK","signal":10516,"analyte":"SA"}
```

The `seq` value should increase for each measurement so duplicate BLE/Wi-Fi packets can be ignored.
