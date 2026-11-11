# Changelog

## v2.0.0

### Added
- Preset picker with Category, Group and Preset dropdowns plus search. Over 100 presets: receipts, sticky notes, customer notes, warnings, handling labels, tags, branded labels, parts-bin labels and checklists (`app/presets.js`).
- Customer & order fields (order #, name, phone, email, device).
- Receipts: quick-add item catalog, remembered prices, qty +/- buttons, line totals, discount.
- Formatting toolbar and a ready-made note picker. Markup no longer needs exact spacing, and `**bold**` works mid-line.
- Fixed-size cut-out labels (1 to 4 in) with dashed, box or rounded frames. Text scales to fit. Bin labels print one per line.
- Heading tab: 7 heading styles, heading presets, saved headings, and logo upload converted to black and white (sharp or dithered).
- Separate Date, Time and Customer info toggles.

### Unchanged
- Bluetooth and protocol code (`app/protocol.js`, `app/transport.js`).

## v1.0.0

First release, for the MX10 (Fun Print) printer.

### Added
- Text and receipt app: receipts with items, tax and totals; notes; warning banners; checklists; tags and labels.
- Built-in presets and saved custom presets.
- Exact 1-bit preview with printed length.
- Darkness, speed, copies, feed after print, feed and retract buttons, cancel.
- Optional calibration prints: alignment, darkness ladder, text sizes, tear-off.
- TX/RX log with timestamps, copy and download.
- Diagnostics probe page that lists GATT services and runs test prints.
- Zero-dependency local server and launchers for Windows, macOS and Linux.

### Fixed (compared with opuu/cat-printer)
- Transparent or unfilled canvas areas printed solid black.
- Long text was not wrapped and could leave black areas past 500 px.
- Blank rows were skipped, so spacing between lines collapsed.
- No paper feed after printing, so the last line tore off.
- Buffer-full notifications were ignored.
- Status polling interleaved with print data and caused write errors.

### Not yet tested
- Very long prints that trigger repeated buffer-full pauses.
- Cancel in the middle of a long print.
- Printers other than the MX10.
- Linux and macOS.
