import { db } from '@/lib/db/index'
import { userEvents } from '@/lib/db/schema'
import { v4 as uuid } from 'uuid'

export function trackEvent(
  eventType: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  db.insert(userEvents).values({
    id: uuid(),
    eventType,
    targetType,
    targetId,
    metadata: metadata || null,
    createdAt: new Date().toISOString(),
  }).run()
}
