// A small ZIP writer and reader for backups. Files are stored without compression,
// because photos are compressed already. The writer refers to the original Blobs instead
// of copying them, and the reader slices each file out of the archive only when it is
// asked for, so a large backup never has to fit in memory at once.

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const UTF8_NAMES = 0x0800;
const ZIP_VERSION = 20;
const STORED = 0;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const MAX_ENTRIES = 0xffff;
const MAX_OFFSET = 0xffffffff;

let crcTable = null;

function getCrcTable() {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let byte = 0; byte < 256; byte += 1) {
      let value = byte;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[byte] = value >>> 0;
    }
  }
  return crcTable;
}

export function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = table[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

async function readBytes(blob, start = 0, end = blob.size) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

// `entries` is a list of `{ name, data }`, where `data` is a string or a Blob.
export async function createZip(entries, { date = new Date() } = {}) {
  if (entries.length > MAX_ENTRIES) throw new Error('Too many files for one archive');

  const { time, day } = toDosDateTime(date);
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name);
    const bytes = typeof data === 'string' ? encoder.encode(data) : await readBytes(data);
    const size = bytes.length;
    const crc = crc32(bytes);
    if (offset + LOCAL_HEADER_SIZE + nameBytes.length + size > MAX_OFFSET) {
      throw new Error('Archive is too large');
    }

    const local = new DataView(new ArrayBuffer(LOCAL_HEADER_SIZE));
    local.setUint32(0, LOCAL_HEADER, true);
    local.setUint16(4, ZIP_VERSION, true);
    local.setUint16(6, UTF8_NAMES, true);
    local.setUint16(8, STORED, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(local.buffer, nameBytes, typeof data === 'string' ? bytes : data);

    const central = new DataView(new ArrayBuffer(CENTRAL_HEADER_SIZE));
    central.setUint32(0, CENTRAL_HEADER, true);
    central.setUint16(4, ZIP_VERSION, true);
    central.setUint16(6, ZIP_VERSION, true);
    central.setUint16(8, UTF8_NAMES, true);
    central.setUint16(10, STORED, true);
    central.setUint16(12, time, true);
    central.setUint16(14, day, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true);
    directory.push(central.buffer, nameBytes);

    offset += LOCAL_HEADER_SIZE + nameBytes.length + size;
  }

  const directorySize = directory.reduce((total, part) => total + part.byteLength, 0);
  if (offset + directorySize > MAX_OFFSET) throw new Error('Archive is too large');

  const end = new DataView(new ArrayBuffer(END_SIZE));
  end.setUint32(0, END_OF_CENTRAL_DIRECTORY, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...directory, end.buffer], { type: 'application/zip' });
}

export async function isZip(blob) {
  if (!blob || blob.size < 4) return false;
  const bytes = await readBytes(blob, 0, 4);
  return new DataView(bytes.buffer).getUint32(0, true) === LOCAL_HEADER;
}

function findEndOfCentralDirectory(tail) {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let index = tail.length - END_SIZE; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === END_OF_CENTRAL_DIRECTORY) return index;
  }
  return -1;
}

// Lists the files in a ZIP archive whose files are stored without compression, as
// createZip writes them. Reading a file returns a slice of the archive.
export async function readZip(blob) {
  const tailStart = Math.max(0, blob.size - END_SIZE - MAX_COMMENT_SIZE);
  const tail = await readBytes(blob, tailStart);
  const endIndex = findEndOfCentralDirectory(tail);
  if (endIndex < 0) throw new Error('Not a ZIP archive');

  const end = new DataView(tail.buffer, tail.byteOffset + endIndex, END_SIZE);
  const count = end.getUint16(10, true);
  const directorySize = end.getUint32(12, true);
  const directoryOffset = end.getUint32(16, true);
  if (directoryOffset + directorySize > blob.size) throw new Error('Damaged ZIP archive');

  const directory = await readBytes(blob, directoryOffset, directoryOffset + directorySize);
  const view = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map();
  let position = 0;

  for (let index = 0; index < count; index += 1) {
    if (position + CENTRAL_HEADER_SIZE > directory.length || view.getUint32(position, true) !== CENTRAL_HEADER) {
      throw new Error('Damaged ZIP archive');
    }
    const nameLength = view.getUint16(position + 28, true);
    const nameEnd = position + CENTRAL_HEADER_SIZE + nameLength;
    if (nameEnd > directory.length) throw new Error('Damaged ZIP archive');

    const name = decoder.decode(directory.subarray(position + CENTRAL_HEADER_SIZE, nameEnd));
    entries.set(name, {
      method: view.getUint16(position + 10, true),
      size: view.getUint32(position + 24, true),
      storedSize: view.getUint32(position + 20, true),
      headerOffset: view.getUint32(position + 42, true),
    });
    position = nameEnd + view.getUint16(position + 30, true) + view.getUint16(position + 32, true);
  }

  async function file(name, type = '') {
    const entry = entries.get(name);
    if (!entry) throw new Error(`Missing file in archive: ${name}`);
    if (entry.method !== STORED || entry.storedSize !== entry.size) {
      throw new Error(`Compressed file in archive: ${name}`);
    }

    const header = await readBytes(blob, entry.headerOffset, entry.headerOffset + LOCAL_HEADER_SIZE);
    if (header.length < LOCAL_HEADER_SIZE) throw new Error('Damaged ZIP archive');
    const headerView = new DataView(header.buffer);
    if (headerView.getUint32(0, true) !== LOCAL_HEADER) throw new Error('Damaged ZIP archive');
    const start = entry.headerOffset + LOCAL_HEADER_SIZE
      + headerView.getUint16(26, true) + headerView.getUint16(28, true);
    if (start + entry.size > blob.size) throw new Error('Damaged ZIP archive');
    return blob.slice(start, start + entry.size, type);
  }

  return {
    names: [...entries.keys()],
    has: name => entries.has(name),
    size: name => entries.get(name)?.size,
    file,
    text: async name => new TextDecoder().decode(await readBytes(await file(name))),
  };
}
