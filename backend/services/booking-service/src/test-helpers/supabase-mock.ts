/**
 * A stand-in for the Supabase client.
 *
 * The real client builds a query by chaining (`.from().select().eq()...`) and
 * only runs it when the chain is awaited. This mock copies that shape: every
 * builder method returns the chain, and awaiting it takes the next result the
 * test queued. It also records every call so a test can assert what was
 * written.
 */

export interface QueuedResult {
  data?: unknown;
  error?: unknown;
  count?: number;
}

export interface RecordedCall {
  table: string;
  op: string;
  payload?: unknown;
}

const CHAIN_METHODS = [
  'select', 'eq', 'neq', 'in', 'lt', 'lte', 'gt', 'gte',
  'or', 'is', 'like', 'ilike', 'order', 'range', 'limit',
  'single', 'maybeSingle',
];

export function createSupabaseMock() {
  const queue: QueuedResult[] = [];
  const calls: RecordedCall[] = [];

  function buildQuery(table: string) {
    const query: Record<string, unknown> = {};

    for (const method of CHAIN_METHODS) {
      query[method] = () => query;
    }

    query.insert = (payload: unknown) => {
      calls.push({ table, op: 'insert', payload });
      return query;
    };
    query.update = (payload: unknown) => {
      calls.push({ table, op: 'update', payload });
      return query;
    };
    query.delete = () => {
      calls.push({ table, op: 'delete' });
      return query;
    };

    // Makes the chain awaitable. An empty queue resolves to an empty result
    // rather than hanging, so an unexpected extra query fails loudly in the
    // assertion instead of timing out.
    query.then = (onFulfilled: unknown, onRejected: unknown) => {
      const next = queue.length > 0 ? queue.shift()! : { data: null, error: null };
      return Promise.resolve(next).then(
        onFulfilled as never,
        onRejected as never,
      );
    };

    return query;
  }

  return {
    client: {
      from(table: string) {
        calls.push({ table, op: 'from' });
        return buildQuery(table);
      },
    },

    /** Queue results in the order the route will consume them. */
    queueResults(...results: QueuedResult[]): void {
      queue.push(...results);
    },

    reset(): void {
      queue.length = 0;
      calls.length = 0;
    },

    calls,

    /** First recorded write of `op` against `table`, if any. */
    findCall(table: string, op: string): RecordedCall | undefined {
      return calls.find(call => call.table === table && call.op === op);
    },

    /** Number of results the route never consumed. */
    unusedResults(): number {
      return queue.length;
    },
  };
}
