# Changelog

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
