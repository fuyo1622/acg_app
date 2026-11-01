import { describe, expect, it } from 'vitest';
import { crc32, createZip, isZip, readZip } from './zipUtils';

const PHOTO_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]);

async function bytesOf(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function sampleArchive() {
  return createZip([
    { name: 'backup.json', data: '{"version":5}' },
    { name: 'photos/items/0001-1.png', data: new Blob([PHOTO_BYTES], { type: 'image/png' }) },
    { name: 'photos/角色.png', data: new Blob([PHOTO_BYTES.slice(0, 4)]) },
  ], { date: new Date(2026, 10, 1, 12, 30, 10) });
}

describe('zipUtils', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('reads back every file it wrote, with its name, contents and type', async () => {
    const archive = await readZip(await sampleArchive());

    expect(archive.names).toEqual(['backup.json', 'photos/items/0001-1.png', 'photos/角色.png']);
    expect(await archive.text('backup.json')).toBe('{"version":5}');
    const photo = await archive.file('photos/items/0001-1.png', 'image/png');
    expect(photo.type).toBe('image/png');
    expect(await bytesOf(photo)).toEqual(PHOTO_BYTES);
    expect(archive.size('photos/角色.png')).toBe(4);
    expect(archive.has('photos/missing.png')).toBe(false);
    await expect(archive.file('photos/missing.png')).rejects.toThrow('Missing file in archive');
  });

  it('writes standard stored entries that other ZIP tools can check', async () => {
    const bytes = await bytesOf(await sampleArchive());
    const view = new DataView(bytes.buffer);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(8, true)).toBe(0); // stored, not compressed
    expect(view.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('{"version":5}')));
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(3);
  });

  it('tells a ZIP archive from other files', async () => {
    expect(await isZip(await sampleArchive())).toBe(true);
    expect(await isZip(new Blob(['{"version":4}']))).toBe(false);
    expect(await isZip(new Blob(['PK']))).toBe(false);
  });

  it('refuses a damaged archive', async () => {
    const archive = await sampleArchive();

    await expect(readZip(archive.slice(0, archive.size - 30))).rejects.toThrow();
    await expect(readZip(new Blob(['not a zip at all']))).rejects.toThrow('Not a ZIP archive');
  });

  it('refuses compressed files, which backups never contain', async () => {
    const bytes = await bytesOf(await sampleArchive());
    const view = new DataView(bytes.buffer);
    const directoryOffset = view.getUint32(bytes.length - 22 + 16, true);
    view.setUint16(directoryOffset + 10, 8, true); // mark the first file as deflated

    const archive = await readZip(new Blob([bytes]));
    await expect(archive.file('backup.json')).rejects.toThrow('Compressed file in archive');
  });
});
