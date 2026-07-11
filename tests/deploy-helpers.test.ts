import { describe, expect, it } from 'vitest';
import { selectReleasesToDelete } from '../src/lib/releases';

describe('selectReleasesToDelete', () => {
  it('keeps the newest requested releases', () => {
    const releases = ['20260101T000000Z', '20260710T000000Z', '20260711T000000Z'];
    expect(selectReleasesToDelete(releases, '20260711T000000Z', 2)).toEqual(['20260101T000000Z']);
  });

  it('never deletes the current release even when it is old', () => {
    const releases = ['20260101T000000Z', '20260710T000000Z', '20260711T000000Z'];
    expect(selectReleasesToDelete(releases, '20260101T000000Z', 1)).not.toContain('20260101T000000Z');
  });
});
