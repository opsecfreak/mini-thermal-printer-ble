# mini-thermal-printer-ble

Browser-based print app for generic BLE mini thermal printers (Fun Print / MX10 "cat printer"). Connects over Web Bluetooth in Chrome. No app, no account, no install.

Based on [opuu/cat-printer](https://github.com/opuu/cat-printer) (AGPL-3.0), reworked for more reliable printing and finer control.

## What's different from the original

- **No more black or blank sheets.** The canvas is flattened to white before conversion, so transparent pixels no longer print as solid black.
- **Text wraps and shows correctly.** Canvas height follows the wrapped text.
- **Flow control.** Writes pause when the printer reports its buffer is full and resume when it clears.
- **Error handling.** One write queue, no status polling mid-print, clear error messages instead of silent failures.
- **Correct paper feed.** Accurate feed and retract after each job.
- **Dithering** for photos and images.
- **Adjustable settings:** density (energy), speed, and print options.

## Supported printers

| Model | Paper | Resolution | Status |
|-------|-------|------------|--------|
| MX10 (Fun Print app) | 57mm thermal | 384px / 203 DPI | Tested |

Other "cat printer" models using the same `51 78` protocol may work, but they are untested.

## Requirements

- Chrome or Edge on desktop (Web Bluetooth)
- A Bluetooth LE adapter
- The page must be served from `localhost` or HTTPS. Opening the file directly will not work.

## Usage

1. Clone the repo:
