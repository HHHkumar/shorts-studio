// ---------------------------------------------------------------------------
// A very small ZIP writer.
//
// Written out rather than pulled in, because the alternative is a dependency
// with its own dependencies for something the format spec covers in a page. It
// does exactly one thing: take a list of {name, data} and return a Buffer that
// every unzip program on earth opens. No directories, no encryption, no zip64.
//
// Deflate rather than store, because a publish kit is mostly text and text
// halves. zlib.deflateRawSync IS the compression ZIP method 8 wants - the "raw"
// matters, a zlib header here would produce an archive that fails its checksum.
// ---------------------------------------------------------------------------

import { deflateRawSync } from 'node:zlib';

/** CRC-32, which ZIP requires per entry. Table built once on first use. */
let TABLE = null;
function crcTable() {
  if (TABLE) return TABLE;
  TABLE = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    TABLE[i] = c;
  }
  return TABLE;
}

function crc32(buf) {
  const table = crcTable();
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** MS-DOS packed date and time, which is what the format stores. */
function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/**
 * Build a zip archive in memory.
 *
 * `files` is [{ name, data }] where data is a Buffer or a string. Names use
 * forward slashes whatever the platform - a backslash in a zip entry name is a
 * literal character on every other system, not a folder.
 */
export function makeZip(files, when = new Date()) {
  const { time, day } = dosStamp(when);
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(String(file.name).replace(/\\/g, '/'), 'utf8');
    const body = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'utf8');
    const packed = deflateRawSync(body);
    const crc = crc32(body);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);      // version needed
    local.writeUInt16LE(0x800, 6);   // flag bit 11: the name is UTF-8
    local.writeUInt16LE(8, 8);       // method: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);      // no extra field

    chunks.push(local, name, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);      // version made by
    entry.writeUInt16LE(20, 6);      // version needed
    entry.writeUInt16LE(0x800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(day, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);      // extra
    entry.writeUInt16LE(0, 32);      // comment
    entry.writeUInt16LE(0, 34);      // disk
    entry.writeUInt16LE(0, 36);      // internal attributes
    entry.writeUInt32LE(0, 38);      // external attributes
    entry.writeUInt32LE(offset, 42); // where its local header starts
    central.push(entry, name);

    offset += local.length + name.length + packed.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);                  // this disk
  end.writeUInt16LE(0, 6);                  // disk with the directory
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);                 // no archive comment

  return Buffer.concat([...chunks, directory, end]);
}
