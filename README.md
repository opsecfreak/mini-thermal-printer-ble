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
   ```
   git clone https://github.com/opsecfreak/mini-thermal-printer-ble.git
   cd mini-thermal-printer-ble
   ```
2. Start the local server: `<start command>`
3. Open `http://localhost:<port>` in Chrome.
4. Turn on the printer, click **Connect**, and select it from the list.
5. Load text or an image, adjust the settings, check the preview, and click **Print**.

## How it works

Each image is converted to 1-bit black and white, one 384-pixel row at a time. Each row is wrapped in a command packet:

```
51 78 | CMD | 00 | LEN (2 bytes, LE) | DATA | CRC8 | FF
```

The packets are written to the printer's GATT characteristic over BLE. The printer reports status, busy, and buffer-full states back through notifications.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Printer not in the device list | Check the Bluetooth adapter, close the Fun Print app on your phone, power-cycle the printer |
| Faint print | Raise the density |
| Smearing or slow feed | Lower the speed or the density |
| Print stops mid-job | Check the paper roll; reconnect and retry |

## Credits

- [opuu/cat-printer](https://github.com/opuu/cat-printer): original Web Bluetooth SDK this project is built on
- [werwolv: Reverse engineering a cat printer](https://werwolv.net/blog/cat_printer): protocol and CRC8 write-up
- [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer): protocol reference

## License

AGPL-3.0, same as the original. See [LICENSE](LICENSE).
