import { describe, expect, it } from 'vitest';
import { APP_RELEASE_URL, APP_VERSION } from './version';

describe('application version', () => {
  it('uses a semantic version supplied by the build', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('links to the matching GitHub release', () => {
    expect(APP_RELEASE_URL).toBe(
      `https://github.com/fuyo1622/acg_app/releases/tag/v${APP_VERSION}`,
    );
  });
});
