# PlantSOS Hormone Analyzer

PlantSOS is a mobile-first, installable web application developed by the CUHKSZ iGEM team. It receives or imports plant-hormone assay results, keeps a local history, visualizes 96-well plate measurements, highlights concentrations outside configured reference ranges, summarizes time trends, and exports the combined records as CSV.

The software is intended for field users, wet-lab team members, judges, and future iGEM teams who need to inspect SA, ABA, and JA-Ile results without a laboratory computer. It runs entirely in a supported browser and does not require an account or cloud database.

Live demonstration: <https://reign419.github.io/>

## Features

- Import XLSX, XLS, CSV, TSV, JSON, or JSONL result files.
- Receive live measurements over Web Bluetooth on supported browsers.
- Receive or download measurements from the instrument Wi-Fi interface.
- Preserve instrument-provided concentration, unit, signal, timestamp, and QC fields.
- Merge newly imported records with the existing browser-local history.
- Filter SA, ABA, and JA-Ile records and visualize a 96-well plate.
- Evaluate concentrations against configured ranges after conversion to µM.
- Summarize historical trends and provide deterministic next-step guidance.
- Delete individual records or clear the complete local history.
- Export the current combined history as CSV, including dates and timestamps.
- Switch between Chinese and English and install the site as a PWA.

## Reference ranges and decision rules

PlantSOS currently uses the following inclusive reference ranges:

| Analyte | Lower bound | Upper bound | Unit |
| --- | ---: | ---: | --- |
| SA | 0.3 | 3 | µM |
| ABA | 0.005 | 0.05 | µM |
| JA-Ile | 10 | 100 | µM |

Compatible molar units are converted to µM before classification. Values on either boundary are classified as normal. The source `qc` field is retained for traceability; the displayed concentration status is calculated from the ranges above. Instrument states such as saturation or missing calibration remain higher-priority warnings.

The demo firmware may generate synthetic concentrations with:

```text
L_n = max(C_min, 0.9 × C_(n-1))
H_n = min(C_max, 1.1 × C_(n-1))
C_n = L_n + U_n × (H_n - L_n), where U_n is uniform on [0, 1]
```

This formula is only a demonstration-data generator. The web application does not use it to overwrite or recalculate measurements received from a device or file.

## Data flow

1. The optical detector and analogue front end convert light into an electrical signal.
2. The ADS1256 digitizes that signal.
3. The ESP32 firmware applies the instrument's validated conversion and sends both the acquired signal and concentration.
4. PlantSOS preserves those values, converts compatible units for comparison, displays results, and stores history in the current browser.

The website does **not** infer concentration from a raw `signal` value. See [DEVICE_INTERFACE.md](DEVICE_INTERFACE.md) for the BLE and Wi-Fi message contract.

## Installation

Requirements:

- Git
- Node.js 20 or later
- npm 10 or later (included with current Node.js releases)

Clone the team's official iGEM GitLab repository and install the exact dependency graph:

```bash
git clone <official-iGEM-GitLab-repository-url>
cd <repository-directory>
npm ci
```

The application has no downloaded runtime packages. React, React DOM, and the XLSX reader are vendored browser bundles whose versions and licenses are recorded in [NOTICE](NOTICE). The committed `package-lock.json` records the tested empty npm dependency graph and Node requirement.

## Build

Create a clean deployable copy in `build/`:

```bash
npm run build
```

The build script copies the browser source and static assets without compilation. The checked-in HTML, JavaScript, and CSS are the deployable source; no opaque executable or firmware binary is required.

## Run locally

Build and start the dependency-free local server:

```bash
npm start
```

Then open <http://127.0.0.1:8080/>. Stop the server with `Ctrl+C`.

Bluetooth requires a secure context in normal browser deployments. For live-device testing, use HTTPS on a Web Bluetooth-capable browser. The local server is primarily for file-import and interface verification.

## Test

Run all deterministic data-processing and repository-completeness tests:

```bash
npm test
```

Run the complete build and test check used before release:

```bash
npm run verify
```

The submitted tests cover normalization, zero and missing values, unit conversion, configured reference ranges, trend analysis, record merging, deletion, CSV export, and required repository files. Additional integration tests can be added for a team's exact firmware and browser test matrix.

## Reproduce the main results

1. Run `npm ci`.
2. Run `npm run verify` and confirm that every test prints `PASS`.
3. Run `npm start` and open <http://127.0.0.1:8080/>.
4. Select **Import data**.
5. Import [`samples/demo-history.csv`](samples/demo-history.csv).
6. Confirm that 45 records are present: five timestamps × three analytes × three replicates.
7. Select SA, ABA, and JA-Ile in turn. Confirm that the overview, 96-well plate, recent records, reference-range status, and history chart update independently for each analyte.
8. Open the records view, delete one record, then re-import the file. Confirm that new records merge with current history rather than replacing unrelated records.
9. Export the combined results and confirm that the CSV includes `date`, `recorded_at`, analyte, concentration, unit, source QC, and signal fields when supplied.

The sample file contains synthetic demonstration concentrations, not experimental measurements. It is provided only to reproduce the user interface and analysis workflow.

## Input data

The preferred JSON/JSONL payload is:

```json
{
  "v": 1,
  "type": "result",
  "run": "RUN-2026-01",
  "plate": "P1",
  "well": "A1",
  "sample": "Plant-01",
  "analyte": "SA",
  "value": 1.02,
  "unit": "uM",
  "qc": "OK",
  "signal": 5000,
  "ts": "2026-10-19T08:00:00+08:00"
}
```

`value` is the concentration supplied by the device or file. `signal` is the acquired detector value and its physical interpretation depends on the instrument firmware. `concentration` remains accepted as a legacy alias for `value`.

## Project layout

```text
.
├── assets/                  Browser modules and vendored libraries
├── samples/                 Synthetic reproducibility data
├── scripts/                 Dependency-free build and local server
├── tests/                   Node.js tests
├── index.html               Application entry point
├── ble-results-v2.js        BLE result receiver
├── phase1-results-v2.js     Device and PWA integration
├── sw.js                    Offline cache service worker
├── DEVICE_INTERFACE.md      Instrument transport contract
├── LICENSE                  Apache License 2.0
├── NOTICE                   Attribution and third-party components
├── package.json             Reproducible commands
└── package-lock.json        Locked dependency graph
```

## Browser support

- File import, analysis, history, CSV export, and PWA features work in current Chromium, Firefox, and Safari releases where the underlying web APIs are available.
- Web Bluetooth is intended for current Chromium-based browsers on Android and desktop. Browser and operating-system support may change.
- iPhone/iPad users should use the instrument Wi-Fi interface because Safari does not provide general Web Bluetooth support.
- Data stays in the current browser unless the user exports it.

## AI disclosure

PlantSOS does not load, train, fine-tune, or call an AI/ML model or commercial AI API at runtime. Concentration status, trend summaries, and next-step suggestions are deterministic rules implemented in the repository. Therefore, there is no model training dataset or model-performance evaluation to reproduce.

The suggestions are workflow prompts, not autonomous scientific conclusions. They must be interpreted together with calibration controls, biological replicates, experimental context, and the instrument's own QC information.

## Known limitations

- The web application does not convert raw optical or electrical signals into concentrations; that conversion belongs to validated instrument firmware or an external calibration workflow.
- Reference ranges are project configuration values and are not universal biological thresholds for every species, tissue, developmental stage, or experimental condition.
- Trend analysis is descriptive and does not establish causality.
- Browser-local data can be lost when site storage is cleared; export CSV files for durable records.
- BLE availability depends on the browser, operating system, HTTPS context, device permissions, and the detector advertisement state.
- The demonstration CSV must not be represented as experimental data.

## Repository and release policy

The competition submission must be hosted in the CUHKSZ team's official repository on iGEM GitLab. Other mirrors and deployment repositories are supplementary and do not replace the official iGEM GitLab submission.

Keep the repository below 50 MB. Store large datasets, videos, model weights, and other heavy artifacts on Zenodo and link their DOI from this README rather than committing them to Git.

## License

Original PlantSOS software is licensed under the [Apache License 2.0](LICENSE). Third-party components retain their original licenses; see [NOTICE](NOTICE).

Copyright 2026 CUHKSZ iGEM Team.
