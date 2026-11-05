let receivedAt: number | null = null;

/** El replay conserva el instante real de recepción, no la hora de apertura. */
export function notificationReceivedAt(): number {
  return receivedAt ?? Date.now();
}

export function withNotificationTimestamp<T>(timestamp: number, callback: () => T): T {
  const previous = receivedAt;
  receivedAt = timestamp;
  try { return callback(); } finally { receivedAt = previous; }
}
