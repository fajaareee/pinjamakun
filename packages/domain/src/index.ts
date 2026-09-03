export type InvitationState = 'pending' | 'accepted' | 'expired' | 'revoked';
export type GrantState = 'pending_keys' | 'active' | 'expired' | 'revoked';

export type Invitation = Readonly<{
  state: InvitationState;
  expiresAt: Date;
  revokedAt?: Date;
  acceptedAt?: Date;
}>;

export function effectiveInvitationState(invitation: Invitation, now: Date): InvitationState {
  if (invitation.revokedAt !== undefined || invitation.state === 'revoked') return 'revoked';
  if (invitation.acceptedAt !== undefined || invitation.state === 'accepted') return 'accepted';
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

export function canAcceptInvitation(invitation: Invitation, now: Date): boolean {
  return effectiveInvitationState(invitation, now) === 'pending';
}

export type DeviceLimitInput = Readonly<{
  activeDeviceIds: ReadonlySet<string>;
  requestingDeviceId: string;
  maximumDevices: number;
}>;

export function canActivateDevice(input: DeviceLimitInput): boolean {
  if (!Number.isSafeInteger(input.maximumDevices) || input.maximumDevices < 1) return false;
  return (
    input.activeDeviceIds.has(input.requestingDeviceId) ||
    input.activeDeviceIds.size < input.maximumDevices
  );
}
