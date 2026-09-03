import { describe, expect, it } from 'vitest';
import { canAcceptInvitation, canActivateDevice, effectiveInvitationState } from './index.js';

describe('invitation policy', () => {
  const expiresAt = new Date('2030-01-02T00:00:00Z');

  it('expires at the exact boundary', () => {
    const invitation = { state: 'pending' as const, expiresAt };
    expect(effectiveInvitationState(invitation, expiresAt)).toBe('expired');
    expect(canAcceptInvitation(invitation, expiresAt)).toBe(false);
  });

  it('prioritizes revocation', () => {
    const invitation = {
      state: 'accepted' as const,
      expiresAt,
      revokedAt: new Date('2030-01-01T00:00:00Z'),
    };
    expect(effectiveInvitationState(invitation, new Date('2030-01-01T12:00:00Z'))).toBe('revoked');
  });
});

describe('device limit policy', () => {
  it('allows an already active device without consuming another slot', () => {
    expect(
      canActivateDevice({
        activeDeviceIds: new Set(['device-a']),
        requestingDeviceId: 'device-a',
        maximumDevices: 1,
      }),
    ).toBe(true);
  });

  it('rejects a new device when full', () => {
    expect(
      canActivateDevice({
        activeDeviceIds: new Set(['device-a']),
        requestingDeviceId: 'device-b',
        maximumDevices: 1,
      }),
    ).toBe(false);
  });
});
