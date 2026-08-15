import { describe, expect, it } from 'vitest';
import { configuredCliPassword, hasCliFlag, readCliOption } from '../admin/cli/options';

describe('administrator CLI options', () => {
  it('reads explicit named options without accepting missing values', () => {
    expect(readCliOption(['node', 'cli', '--username', 'owner'], '--username')).toBe('owner');
    expect(readCliOption(['node', 'cli', '--username'], '--username')).toBeUndefined();
  });

  it('recognizes explicit boolean safety flags', () => {
    expect(hasCliFlag(['node', 'cli', '--replace-admin'], '--replace-admin')).toBe(true);
    expect(hasCliFlag(['node', 'cli'], '--replace-admin')).toBe(false);
  });

  it('uses the one-time bootstrap environment password without requiring a TTY', () => {
    expect(configuredCliPassword(['node', 'cli'], {
      ADMIN_BOOTSTRAP_PASSWORD: 'temporary-password',
    })).toBe('temporary-password');
  });

  it('lets an explicit password override the environment value', () => {
    expect(configuredCliPassword(
      ['node', 'cli', '--password', 'explicit-password'],
      { ADMIN_BOOTSTRAP_PASSWORD: 'environment-password' },
    )).toBe('explicit-password');
  });
});
