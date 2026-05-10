/** 多后端 RpcClient 聚合，便于 fanout 调用。 */
import { RpcClient } from './rpc-client';

export interface BackendToken {
  name: string;
  backend_url: string;
  token: string;
}

export interface PoolEntry {
  name: string;
  client: RpcClient;
}

export class BackendPool {
  entries: PoolEntry[];

  constructor(tokens: BackendToken[]) {
    this.entries = tokens.map((t) => ({
      name: t.name,
      client: new RpcClient(t.backend_url, t.token, t.name),
    }));
  }

  async fanout<T, A extends unknown[]>(
    method: (client: RpcClient, ...args: A) => Promise<T>,
    ...args: A
  ) {
    const settled = await Promise.allSettled(
      this.entries.map((e) =>
        method(e.client, ...args).then((rows) => ({ source: e.name, rows }))
      )
    );
    const ok: { source: string; rows: T }[] = [];
    const errors: { source: string; error: unknown }[] = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') ok.push(r.value);
      else errors.push({ source: this.entries[i].name, error: r.reason });
    });
    return { ok, errors };
  }

  close() {
    for (const e of this.entries) {
      e.client.close();
    }
  }

  /** 任一后端 WebSocket 已连通即视为在线 */
  isAnyWebSocketOpen(): boolean {
    return this.entries.some((e) => e.client.isWebSocketOpen());
  }
}
