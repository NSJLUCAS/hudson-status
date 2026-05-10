import { useEffect, useState } from 'react';
import { taskQuery } from '@/lib/rpc-methods';
import type { BackendPool } from '@/lib/backend-pool';
import type { TaskQueryResult } from '@/lib/nodeget-types';

const WINDOW_MS_DEFAULT = 60 * 60 * 1000;
const REFRESH_MS = 10_000;
const QUERY_TIMEOUT_MS = 20_000;

function clean(rows: TaskQueryResult[] | undefined): TaskQueryResult[] {
  return (rows ?? [])
    .filter((r) => r.cron_source && r.cron_source !== '未知')
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function useNodeLatency(
  pool: BackendPool | null,
  source: string | null,
  uuid: string | null
) {
  const [pingData, setPingData] = useState<TaskQueryResult[]>([]);
  const [tcpData, setTcpData] = useState<TaskQueryResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPingData([]);
    setTcpData([]);

    if (!pool || !source || !uuid) return;
    const entry = pool.entries.find((e) => e.name === source);
    if (!entry) return;

    let cancelled = false;

    const fetchOnce = async () => {
      const now = Date.now();
      const window: [number, number] = [now - WINDOW_MS_DEFAULT, now];
      setLoading(true);

      const [ping, tcp] = await Promise.allSettled([
        taskQuery(
          entry.client,
          [{ uuid }, { timestamp_from_to: window }, { type: 'ping' }],
          QUERY_TIMEOUT_MS
        ),
        taskQuery(
          entry.client,
          [{ uuid }, { timestamp_from_to: window }, { type: 'tcp_ping' }],
          QUERY_TIMEOUT_MS
        ),
      ]);

      if (cancelled) return;
      if (ping.status === 'fulfilled') setPingData(clean(ping.value));
      if (tcp.status === 'fulfilled') setTcpData(clean(tcp.value));
      setLoading(false);
    };

    void fetchOnce();
    const timer = setInterval(() => void fetchOnce(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pool, source, uuid]);

  return { pingData, tcpData, loading };
}

/** 仅拉取 ICMP Ping；`windowMs` 默认近 1 小时，详情弹窗可传 6 小时等 */
export function useNodePingData(
  pool: BackendPool | null,
  source: string | null,
  uuid: string | null,
  windowMs: number = WINDOW_MS_DEFAULT
) {
  const [pingData, setPingData] = useState<TaskQueryResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPingData([]);
    if (!pool || !source || !uuid) return;
    const entry = pool.entries.find((e) => e.name === source);
    if (!entry) return;

    let cancelled = false;

    const fetchOnce = async () => {
      const now = Date.now();
      const window: [number, number] = [now - windowMs, now];
      setLoading(true);
      try {
        const rows = await taskQuery(
          entry.client,
          [{ uuid }, { timestamp_from_to: window }, { type: 'ping' }],
          QUERY_TIMEOUT_MS
        );
        if (!cancelled) setPingData(clean(rows));
      } catch {
        if (!cancelled) setPingData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchOnce();
    const timer = setInterval(() => void fetchOnce(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pool, source, uuid, windowMs]);

  return { pingData, loading };
}
