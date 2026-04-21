import { describe, it, expect } from 'vitest';
import { validateBackupPayload } from './backupUtils';
import { BACKUP_VERSION } from './constants';

describe('validateBackupPayload', () => {
  it('throws when payload format is completely broken', () => {
    expect(() => validateBackupPayload(null, BACKUP_VERSION)).toThrow('Payload is not an object');
    expect(() => validateBackupPayload({ version: 999 }, BACKUP_VERSION)).toThrow('Unsupported backup version: 99');
    expect(() => validateBackupPayload({ version: BACKUP_VERSION }, BACKUP_VERSION)).toThrow('Backup items missing');
  });

  it('throws on items containing missing merchandise_type', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', character: 'Asuka', notes: '' } // missing merchandise_type
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('missing merchandise_type');
  });

  it('throws on items entirely missing both series and character fields natively', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: '', character: '  ', merchandise_type: 'figure', notes: '' }
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('must have at least one of series or character');
  });

  it('throws when photo is not an explicitly defined string mapping to data:image', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', merchandise_type: 'figure', photo: 'bad-data' }
      ]
    };
    expect(() => validateBackupPayload(payload, BACKUP_VERSION)).toThrow('invalid photo Data URL');
  });

  it('passes perfectly valid offline serialization footprints natively', () => {
    const payload = {
      version: BACKUP_VERSION,
      items: [
         { series: 'Evangelion', character: 'Asuka', merchandise_type: 'figure', notes: '', photo: 'data:image/png;base64,12345' },
         { series: '', character: 'Rei Ayanami', merchandise_type: 'plush', notes: '', photo: null }
      ]
    };
    expect(validateBackupPayload(payload, BACKUP_VERSION)).toBe(true);
  });
});
