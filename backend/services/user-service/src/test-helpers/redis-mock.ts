/**
 * A stand-in for the Redis client.
 *
 * Only the handful of commands the user service actually uses: get/set/del for
 * one-time codes, and incr/expire for the attempt counters that cap how many
 * times a code may be guessed.
 *
 * Backed by a plain Map, so a test can seed a code and then assert what the
 * route did to it — including that an exhausted code was deleted rather than
 * left available for more guesses.
 */
export function createRedisMock() {
  const store = new Map<string, string>();
  const expiries = new Map<string, number>();

  const client = {
    async get(key: string): Promise<string | null> {
      return store.has(key) ? store.get(key)! : null;
    },

    async set(key: string, value: string, ..._rest: unknown[]): Promise<'OK'> {
      store.set(key, value);
      return 'OK';
    },

    async del(key: string): Promise<number> {
      const existed = store.delete(key);
      expiries.delete(key);
      return existed ? 1 : 0;
    },

    async incr(key: string): Promise<number> {
      const next = Number(store.get(key) ?? '0') + 1;
      store.set(key, String(next));
      return next;
    },

    async expire(key: string, seconds: number): Promise<number> {
      if (!store.has(key)) return 0;
      expiries.set(key, seconds);
      return 1;
    },
  };

  return {
    client,

    /** Seed a value as if it were already stored. */
    seed(key: string, value: string): void {
      store.set(key, value);
    },

    /** Read current state without going through the client. */
    peek(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },

    has(key: string): boolean {
      return store.has(key);
    },

    /** The TTL a route asked for, to check codes are not stored forever. */
    ttlFor(key: string): number | undefined {
      return expiries.get(key);
    },

    reset(): void {
      store.clear();
      expiries.clear();
    },
  };
}
