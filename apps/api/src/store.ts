import type { StoredEvent } from './events.js';

/** 마지막 접속 후 사용자 기록 보관 기간 */
export const USER_RETENTION_DAYS = 365;

/**
 * 저장소 (PRD 10.4). 문서 본문은 절대 저장하지 않는다.
 * - appConfig/current : 기능 플래그 + 점검 안내 문구
 * - users/{sub}       : role, createdAt, lastLoginAt, expireAt (PRD 11.1). 마지막 접속 후 1년이면 TTL 로 자동 삭제
 * - events/{auto}     : 익명 운영 이벤트, expireAt 으로 TTL 삭제
 */
export interface Store {
  getAppConfig(): Promise<Record<string, unknown> | null>;
  touchUser(sub: string, role: string, now: Date): Promise<void>;
  addEvent(event: StoredEvent): Promise<void>;
  countActiveUsers(since: Date): Promise<number>;
  eventsSince(since: Date, limit: number): Promise<Pick<StoredEvent, 'type' | 'errorCode'>[]>;
}

export class MemoryStore implements Store {
  config: Record<string, unknown> | null = null;
  users = new Map<string, { role: string; createdAt: Date; lastLoginAt: Date }>();
  events: StoredEvent[] = [];

  async getAppConfig() {
    return this.config;
  }
  async touchUser(sub: string, role: string, now: Date) {
    const prev = this.users.get(sub);
    this.users.set(sub, { role, createdAt: prev?.createdAt ?? now, lastLoginAt: now });
  }
  async addEvent(event: StoredEvent) {
    this.events.push(event);
  }
  async countActiveUsers(since: Date) {
    return [...this.users.values()].filter((u) => u.lastLoginAt >= since).length;
  }
  async eventsSince(since: Date, limit: number) {
    return this.events.filter((e) => e.receivedAt >= since).slice(-limit);
  }
}

export async function createFirestoreStore(): Promise<Store> {
  const { Firestore, Timestamp } = await import('@google-cloud/firestore');
  const db = new Firestore({ ignoreUndefinedProperties: true });
  return {
    async getAppConfig() {
      const snap = await db.collection('appConfig').doc('current').get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async touchUser(sub, role, now) {
      const ref = db.collection('users').doc(sub);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        tx.set(
          ref,
          {
            role,
            lastLoginAt: Timestamp.fromDate(now),
            // 졸업·전출 등으로 1년 동안 접속하지 않으면 Firestore TTL 이 지운다 (docs/privacy.md)
            expireAt: Timestamp.fromDate(new Date(now.getTime() + USER_RETENTION_DAYS * 24 * 60 * 60 * 1000)),
            ...(snap.exists ? {} : { createdAt: Timestamp.fromDate(now) }),
          },
          { merge: true },
        );
      });
    },
    async addEvent(event) {
      await db.collection('events').add({
        ...event,
        receivedAt: Timestamp.fromDate(event.receivedAt),
        expireAt: Timestamp.fromDate(event.expireAt),
      });
    },
    async countActiveUsers(since) {
      const agg = await db.collection('users').where('lastLoginAt', '>=', Timestamp.fromDate(since)).count().get();
      return agg.data().count;
    },
    async eventsSince(since, limit) {
      const snap = await db
        .collection('events')
        .where('receivedAt', '>=', Timestamp.fromDate(since))
        .select('type', 'errorCode')
        .limit(limit)
        .get();
      return snap.docs.map((d) => ({ type: d.get('type'), errorCode: d.get('errorCode') ?? null }));
    },
  };
}
