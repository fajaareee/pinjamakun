export type SyncCursor = string;

export type SyncEvent = Readonly<{
  sequence: SyncCursor;
  entityType: 'snapshot' | 'grant' | 'device';
  entityId: string;
  operation: 'upsert' | 'delete';
  occurredAt: string;
}>;

export function reduceSyncEvents(events: readonly SyncEvent[]): SyncEvent[] {
  const latest = new Map<string, SyncEvent>();
  for (const event of events) {
    const key = `${event.entityType}:${event.entityId}`;
    const previous = latest.get(key);
    if (previous === undefined || BigInt(event.sequence) > BigInt(previous.sequence)) {
      latest.set(key, event);
    }
  }
  return [...latest.values()].sort((left, right) =>
    BigInt(left.sequence) < BigInt(right.sequence) ? -1 : 1,
  );
}
