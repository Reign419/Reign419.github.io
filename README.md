# PlantSOS Hormone Analyzer

A mobile-first web application developed by CUHKSZ iGEM.

The application imports microplate-reader data from XLSX, CSV, TSV, JSON, or JSONL files, preserves instrument-provided hormone concentrations, visualizes acquired signals, and summarizes results by analyte.

## Features

- XLSX and CSV data import
- 96-well plate visualization
- Instrument-provided hormone concentration display
- Chinese and English interface
- Installable PWA with offline support
- Local data processing in the browser
- Live BLE result reception on supported browsers
- Wi-Fi/WebSocket result reception for iPhone, Android, and desktop browsers
- Local device history and CSV export
- English-first interface with saved language preference
- Device navigation, data-source chooser, and PWA installation guidance

See [DEVICE_INTERFACE.md](DEVICE_INTERFACE.md) for the BLE and Wi-Fi message contract.

## Important Notice

The application does not convert raw detector signals into concentrations. Quantitative interpretation requires a validated analyte-specific calibration supplied by the instrument workflow.

## Team

CUHKSZ iGEM
