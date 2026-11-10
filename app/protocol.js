// MX10 / "cat printer" protocol: packets, CRC8, commands, reply parsing.
// No DOM or Bluetooth code here.
//
// Packet: 51 78 | CMD | TYPE (00 host->printer, 01 reply) | LEN lo hi | DATA | CRC8(DATA) | FF
// Verified on MX10 (probe log 2026-11-10): service AE30, write AE01, notify AE02,
// energy is 4 bytes little endian, mode 01 for text, rows LSB first.

export const ADV_SERVICE = 0xaf30;
export const PRINT_SERVICE = 0xae30;
export const TX_CHAR = 0xae01;
export const RX_CHAR = 0xae02;

export const PRINT_WIDTH = 384;
export const BYTES_PER_ROW = 48;
export const DPI = 203;

export const Cmd = Object.freeze({
  RETRACT: 0xa0,
  FEED: 0xa1,
  ROW: 0xa2,
  STATUS: 0xa3,
  INFO: 0xa8,
  FLOW: 0xae,
  ENERGY: 0xaf,
  SPEED: 0xbd,
  MODE: 0xbe,
  TEMP: 0xd3,
});

const NAMES = {
  0xa0: 'retract', 0xa1: 'feed', 0xa2: 'row', 0xa3: 'status', 0xa8: 'device-info',
  0xae: 'flow', 0xaf: 'energy', 0xbd: 'speed', 0xbe: 'mode', 0xd3: 'temp',
};
export const cmdName = c => NAMES[c] || '0x' + c.toString(16);

const CRC_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  CRC_TABLE[i] = c;
}
export function crc8(data) {
  let c = 0;
  for (const b of data) c = CRC_TABLE[c ^ b];
  return c;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(n) || 0)));
const u16 = n => [n & 0xff, (n >> 8) & 0xff];
const u32 = n => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

export function packet(cmd, payload = []) {
  const p = Uint8Array.from(payload);
  return Uint8Array.from([0x51, 0x78, cmd, 0x00, p.length & 0xff, (p.length >> 8) & 0xff, ...p, crc8(p), 0xff]);
}

export const commands = {
  status: () => packet(Cmd.STATUS, [0x01]),
  deviceInfo: () => packet(Cmd.INFO, [0x00]),
  speed: s => packet(Cmd.SPEED, [clamp(s, 1, 255)]),
  energy: e => packet(Cmd.ENERGY, u32(clamp(e, 0, 0xffff))),
  mode: m => packet(Cmd.MODE, [m ? 1 : 0]),
  feed: n => packet(Cmd.FEED, u16(clamp(n, 0, 0xffff))),
  retract: n => packet(Cmd.RETRACT, u16(clamp(n, 0, 0xffff))),
  row: bytes => {
    if (bytes.length !== BYTES_PER_ROW) throw new Error(`row must be ${BYTES_PER_ROW} bytes`);
    return packet(Cmd.ROW, bytes);
  },
};

export const hex = u8 => Array.from(u8, b => b.toString(16).padStart(2, '0')).join(' ');

export function describeTx(b) {
  if (b.length < 8 || b[0] !== 0x51 || b[1] !== 0x78) return `raw ${b.length} bytes`;
  const len = b[4] | (b[5] << 8);
  const d = b.slice(6, 6 + len);
  switch (b[2]) {
    case Cmd.FEED: case Cmd.RETRACT: return `${cmdName(b[2])} ${d[0] | (d[1] << 8)} lines`;
    case Cmd.ENERGY: return `energy ${(d[0] | (d[1] << 8) | (d[2] << 16) | (d[3] << 24)) >>> 0}`;
    case Cmd.SPEED: case Cmd.MODE: return `${cmdName(b[2])} ${d[0]}`;
    default: return cmdName(b[2]);
  }
}

// Decodes one reply packet into a small event object.
export function decode(pkt) {
  const cmd = pkt[2];
  const len = pkt[4] | (pkt[5] << 8);
  const data = pkt.slice(6, 6 + len);
  const crcOk = pkt[6 + len] === crc8(data) && pkt[7 + len] === 0xff;
  const base = { cmd, name: cmdName(cmd), data, crcOk };
  if (cmd === Cmd.STATUS) {
    const f = data[0] ?? 0;
    return {
      ...base, kind: 'status', flags: f,
      outOfPaper: !!(f & 0x01), coverOpen: !!(f & 0x02), overheat: !!(f & 0x04),
      lowBattery: !!(f & 0x08), // SDK name "lowPower"; seen with byte3 ~191-212
      printing: !!(f & 0x10),   // SDK name "paused"; seen right after sending a job
      busy: !!(f & 0x80),
      level: data.length > 2 ? data[2] : null, // unverified: looks like battery level
    };
  }
  if (cmd === Cmd.FLOW) return { ...base, kind: 'flow', full: data[0] === 0x10, value: data[0] };
  if (cmd === Cmd.TEMP) return { ...base, kind: 'temp', value: data[0] };
  if (cmd === Cmd.INFO) return { ...base, kind: 'info', text: String.fromCharCode(...data.filter(c => c >= 32 && c < 127)) };
  return { ...base, kind: 'other' };
}

// Reassembles notification bytes into complete packets.
export class PacketParser {
  constructor() { this.buf = new Uint8Array(0); }
  reset() { this.buf = new Uint8Array(0); }
  push(bytes) {
    const merged = new Uint8Array(this.buf.length + bytes.length);
    merged.set(this.buf);
    merged.set(bytes, this.buf.length);
    let buf = merged;
    const out = [];
    const junk = [];
    for (;;) {
      let start = -1;
      for (let i = 0; i + 1 < buf.length; i++) if (buf[i] === 0x51 && buf[i + 1] === 0x78) { start = i; break; }
      if (start < 0) {
        if (buf.length && !(buf.length === 1 && buf[0] === 0x51)) { junk.push(...buf); buf = new Uint8Array(0); }
        break;
      }
      if (start > 0) { junk.push(...buf.slice(0, start)); buf = buf.slice(start); }
      if (buf.length < 6) break;
      const len = buf[4] | (buf[5] << 8);
      if (len > 1024) { junk.push(...buf.slice(0, 2)); buf = buf.slice(2); continue; }
      if (buf.length < len + 8) break;
      out.push(buf.slice(0, len + 8));
      buf = buf.slice(len + 8);
    }
    this.buf = buf;
    return { packets: out, junk: Uint8Array.from(junk) };
  }
}
