# mini-thermal-printer-ble

Browser-based print app for generic BLE mini thermal printers (Fun Print / MX10 "cat printer"). Connects over Web Bluetooth in Chrome. No app, no account, no install beyond Node.js for the tiny local server.

Built for **text and receipts**: itemized receipts with totals, notes, warning slips, checklists and labels, with an exact 1-bit preview.

Based on [opuu/cat-printer](https://github.com/opuu/cat-printer) (AGPL-3.0), reworked for more reliable printing and finer control.

## What's different from the original

- **No more black or blank sheets.** The canvas is filled white before conversion, so transparent pixels no longer print as solid black.
- **Text wraps and shows correctly.** Long lines wrap to the 384-dot width, blank lines are kept, and the canvas height follows the text.
- **Paper feeds out after every print** (50 lines by default) so the last line clears the tear bar.
- **Flow control.** Writes pause when the printer reports its buffer is full and resume when it clears, with a timeout and a clear error.
- **One write queue.** Status checks never interleave with print data, so no more "Error writing to printer" mid-job.
- **Receipt tools:** presets, item list with quantity, tax and totals, warning banners, checkboxes, label fields, saved custom presets.
- **Adjustable settings:** darkness (energy), speed, feed after print, copies, plus optional calibration prints.
- **TX/RX log** with timestamps for troubleshooting, and a diagnostics probe page.

## Supported printers

| Model | Paper | Resolution | Status |
|-------|-------|------------|--------|
| MX10 (Fun Print app) | 57mm thermal | 384 dots / 203 DPI | Tested |

Other "cat printer" models using the same `51 78` protocol may work, but they are untested. The probe page (`/probe/`) lists a printer's Bluetooth services and lets you try settings; please open an issue with its log if you test another model.

## Requirements

- Chrome or Edge on desktop with Web Bluetooth (Windows 10+ and macOS work; Linux may need `chrome://flags/#enable-experimental-web-platform-features`)
- A Bluetooth LE adapter
- [Node.js](https://nodejs.org) 18 or newer (only to run the local server; no packages to install)
- The page must be served from `localhost`/`127.0.0.1` or HTTPS. Opening `index.html` as a file will not work.

## Usage

1. Clone the repo:
   ```
   git clone https://github.com/opsecfreak/mini-thermal-printer-ble.git
   cd mini-thermal-printer-ble
   ```
2. Start the local server:
   - Windows: double-click `start.bat`. It starts the server and opens Chrome.
   - macOS / Linux: `./start.sh` (or `node serve.mjs`, or `npm start`)
3. Open `http://127.0.0.1:8384` in Chrome (the Windows launcher does this for you).
4. Turn on the printer, click **Connect printer**, and pick it from the list (MX10 shows up by name).
5. Choose a preset or type, fill in the order line and text, check the preview, and click **Print** (or press Ctrl+P).

Set your shop name, second line and footer under **Shop settings**. Everything is saved in the browser.

The server listens on `127.0.0.1` only, so nothing is exposed to your network. Use `PORT=9000 node serve.mjs` to change the port.

### Text markup

The text box understands a few line prefixes:

| Type this | Prints |
|-----------|--------|
| `# Title` | Big bold centered line |
| `## Heading` | Bold line |
| `> text` | Centered line |
| `- item` | Bullet |
| `[ ] item` / `[x] item` | Checkbox / ticked box |
| `left \| right` | Two columns (e.g. `Labor \| $40.00`) |
| `---` / `===` | Dashed / solid divider |
| `!! TEXT` | White text on a black banner |
| `**text**` | Bold line |

In **Tag / label** mode, `Label: value` lines get a bold label, and an empty value prints a write-in line.

### Calibration (optional)

Under **Calibration** you can print an alignment strip, a darkness ladder (then click the level you like), a text size sheet, and a tear-off test. Default settings already work on the MX10.

## How it works

Text is drawn on a white 384-dot-wide canvas, converted to 1-bit black and white, and sent one row at a time. Each row is wrapped in a command packet:

```
51 78 | CMD | 00 | LEN (2 bytes, LE) | DATA | CRC8 | FF
```

The packets are written to the printer's GATT characteristic `AE01` over BLE. The printer reports status, buffer-full and done states back through notifications on `AE02`. See [docs/PROTOCOL.md](docs/PROTOCOL.md) for the full command list and what was verified on the MX10.

## Project layout

| Path | What it is |
|------|------------|
| `index.html`, `app/` | The app (plain HTML/CSS/ES modules, no build step) |
| `app/protocol.js` | Packets, CRC8, commands, reply parsing |
| `app/transport.js` | Web Bluetooth connection, write queue, flow control |
| `app/render.js` | Text/receipt layout and 1-bit conversion |
| `app/config.js` | App name, default header/footer and built-in presets |
| `probe/` | Diagnostics page: lists GATT services, test prints, saves logs |
| `serve.mjs` | Zero-dependency local server; saves logs to `logs/` |
| `start.bat`, `start.sh` | Launchers |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Printer not in the device list | Check the Bluetooth adapter, close the Fun Print app on your phone, power-cycle the printer |
| "Web Bluetooth is unavailable" | Use Chrome or Edge and open `http://127.0.0.1:8384`, not the file |
| Faint print | Raise **Darkness** |
| Smearing or slow feed | Lower **Darkness**, or the speed under Advanced |
| Last line tears off | Raise **Feed after print** |
| Print stops mid-job | Check the paper roll and battery; reconnect and retry. Open the log for the exact error |

To report a problem, open the **Log** panel, click **Download**, and attach the file.

## Credits

- [opuu/cat-printer](https://github.com/opuu/cat-printer): original Web Bluetooth SDK this project is built on
- [werwolv: Reverse engineering a cat printer](https://werwolv.net/blog/cat_printer): protocol and CRC8 write-up
- [NaitLee/Cat-Printer](https://github.com/NaitLee/Cat-Printer): protocol reference

## License

AGPL-3.0, same as the original. See [LICENSE](LICENSE).
