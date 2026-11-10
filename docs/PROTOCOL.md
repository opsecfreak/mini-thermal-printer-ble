# MX10 protocol notes

What this app sends and receives, and how sure we are of each part. "Verified" means observed on a real MX10 with the probe page (`/probe/`).

## Bluetooth (GATT)

| Service | Characteristic | Properties | Use |
|---------|----------------|------------|-----|
| `AE30` | `AE01` | write without response | **Print data and commands** (verified) |
| `AE30` | `AE02` | notify | **Printer replies** (verified) |
| `AE30` | `AE03` | write without response | Unused |
| `AE30` | `AE04` | notify | Unused |
| `AE30` | `AE05` | indicate | Unused |
| `AE30` | `AE10` | read, write | Unknown config value (reads `00 00 00 00`). Do not write to it. |
| `AE3A` | `AE3B` / `AE3C` | write without response / notify | Separate vendor service, unused |

The printer advertises service `AF30` and the name `MX10`.

## Packet format

```
51 78 | CMD | TYPE | LEN lo | LEN hi | DATA ... | CRC8(DATA) | FF
```

- `TYPE` is `00` for host to printer and `01` for printer replies.
- CRC8 uses polynomial `0x07`, initial value `0`, computed over `DATA` only.

## Commands sent

| CMD | Name | Payload | Notes |
|-----|------|---------|-------|
| `a3` | Status | `01` | Printer answers with an `a3` reply (verified) |
| `bd` | Speed | 1 byte | `32` while printing, `8` while feeding (verified) |
| `af` | Energy (darkness) | **4 bytes**, little endian | `24000` = `c0 5d 00 00` (verified). Some other models use 2 bytes. |
| `be` | Mode | `01` | `01` = text mode, used for all prints (verified) |
| `a2` | Raster row | 48 bytes | 384 dots, `1` = black, **leftmost dot = bit 0** (LSB first, verified) |
| `a1` | Feed | 2 bytes LE (lines) | 8 lines = 1 mm (verified) |
| `a0` | Retract | 2 bytes LE (lines) | |
| `a8` | Device info | `00` | Reply not yet decoded |

Print sequence used by the app: `a3` status, `bd` speed, `af` energy, `be 01`, all `a2` rows (blank rows included, so spacing is kept), then `bd 08`, `a1` feed, `bd` speed.

## Replies (notifications on AE02)

| Reply | Meaning |
|-------|---------|
| `51 78 a3 01 03 00 F1 F2 L CRC ff` | Status. `F1` bits: `0x01` out of paper, `0x02` cover open, `0x04` overheat, `0x08` low battery (seen with `L` around 190-210), `0x10` printing, `0x80` busy. `L` looks like a battery level (unverified). |
| `51 78 ae 01 01 00 10 70 ff` | Buffer full: stop writing |
| `51 78 ae 01 01 00 00 00 ff` | Buffer OK / job finished. Arrives a few seconds after the last row, when the paper stops. |
| `51 78 d3 01 01 00 NN CRC ff` | Value reported while printing, likely head temperature in °C (25 seen at room temperature) |

## Timing

Rows are written about every 7 ms (5 ms delay plus the write). A 312-row receipt took 2.4 s to send without any buffer-full pause. Longer jobs pause automatically when `ae ... 10` arrives.
