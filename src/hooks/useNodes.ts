/** 聚合 NodeGet RPC：节点列表、动态指标、WebSocket 连接池。 */
import { useEffect, useMemo, useState, useRef } from 'react';
import { BackendPool } from '@/lib/backend-pool';
import { dynamicSummaryMulti, kvGetMulti, listAgentUuids, staticDataMulti } from '@/lib/rpc-methods';
import { isOnline } from '@/lib/nodeget-utils';
import type { DynamicSummary, HistorySample, Node, NodeMeta, SiteConfig } from '@/lib/nodeget-types';

type Agent = Pick<Node, 'uuid' | 'source' | 'meta' | 'static'>;

const STATIC_FIELDS = ['cpu', 'system'];
const DYNAMIC_FIELDS = [
  'cpu_usage', 'used_memory', 'total_memory', 'available_memory',
  'used_swap', 'total_swap', 'total_space', 'available_space',
  'read_speed', 'write_speed', 'receive_speed', 'transmit_speed',
  'total_received', 'total_transmitted', 'load_one', 'load_five',
  'load_fifteen', 'uptime', 'boot_time', 'process_count',
  'tcp_connections', 'udp_connections',
];
const META_KEYS = [
  'metadata_name', 'metadata_region', 'metadata_tags', 'metadata_hidden',
  'metadata_virtualization', 'metadata_latitude', 'metadata_longitude',
  'metadata_order', 'metadata_price', 'metadata_price_unit',
  'metadata_price_cycle', 'metadata_expire_time',
];
const DYN_INTERVAL_MS = 2000;
const HISTORY_LIMIT = 60;

function emptyMeta(): NodeMeta {
  return {
    name: '', region: '', tags: [], hidden: false, virtualization: '',
    lat: null, lng: null, order: 0, price: 0, priceUnit: '$',
    priceCycle: 30, expireTime: '',
  };
}

function blankAgent(uuid: string, source: string): Agent {
  return { uuid, source, meta: emptyMeta(), static: {} };
}

function parseMeta(raw: Record<string, unknown>): NodeMeta {
  const lat = Number(raw.metadata_latitude);
  const lng = Number(raw.metadata_longitude);
  const order = Number(raw.metadata_order);
  const price = Number(raw.metadata_price);
  const cycle = Number(raw.metadata_price_cycle);
  return {
    name: raw.metadata_name ? String(raw.metadata_name) : '',
    region: raw.metadata_region ? String(raw.metadata_region) : '',
    tags: Array.isArray(raw.metadata_tags) ? raw.metadata_tags.filter(Boolean) : [],
    hidden: Boolean(raw.metadata_hidden),
    virtualization: raw.metadata_virtualization ? String(raw.metadata_virtualization) : '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    order: Number.isFinite(order) ? order : 0,
    price: Number.isFinite(price) ? price : 0,
    priceUnit: raw.metadata_price_unit ? String(raw.metadata_price_unit) : '$',
    priceCycle: Number.isFinite(cycle) && cycle > 0 ? cycle : 30,
    expireTime: raw.metadata_expire_time ? String(raw.metadata_expire_time) : '',
  };
}

function sampleFrom(row: DynamicSummary): HistorySample {
  const memTotal = row.total_memory || 0;
  const diskTotal = row.total_space || 0;
  return {
    t: row.timestamp,
    cpu: row.cpu_usage ?? null,
    mem: memTotal && row.used_memory != null ? (row.used_memory / memTotal) * 100 : null,
    disk: diskTotal && row.available_space != null
      ? ((diskTotal - row.available_space) / diskTotal) * 100 : null,
    netIn: row.receive_speed ?? 0,
    netOut: row.transmit_speed ?? 0,
  };
}

// Convert potentially-second timestamp to milliseconds
function tsToMs(ts: number): number {
  return ts < 1e12 ? ts * 1000 : ts;
}

export function useNodes(config: SiteConfig | null) {
  const [agents, setAgents] = useState<Map<string, Agent>>(new Map());
  const [live, setLive] = useState<Map<string, DynamicSummary>>(new Map());
  const [history, setHistory] = useState<Map<string, HistorySample[]>>(new Map());
  const [errors, setErrors] = useState<{ source: string; error: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pool, setPool] = useState<BackendPool | null>(null);
  const poolRef = useRef<BackendPool | null>(null);
  const sourceUuidsRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!config?.site_tokens?.length) {
      setLoading(false);
      setPool(null);
      return;
    }

    const poolInstance = new BackendPool(config.site_tokens);
    poolRef.current = poolInstance;
    setPool(poolInstance);
    const sourceUuids = new Map<string, string[]>();
    sourceUuidsRef.current = sourceUuids;

    const bootstrap = async () => {
      const agentsRes = await poolInstance.fanout(listAgentUuids);
      setErrors((prev) => [...prev, ...agentsRes.errors]);

      const seed = new Map<string, Agent>();
      for (const { source, rows } of agentsRes.ok) {
        const uuids = rows ?? [];
        sourceUuids.set(source, uuids);
        for (const uuid of uuids) seed.set(uuid, blankAgent(uuid, source));
      }
      setAgents(seed);

      await Promise.all(
        poolInstance.entries.map(async (entry) => {
          const uuids = sourceUuids.get(entry.name) || [];
          if (!uuids.length) return;

          const kvItems = uuids.flatMap((u) =>
            META_KEYS.map((k) => ({ namespace: u, key: k }))
          );
          const [meta, stat] = await Promise.allSettled([
            kvGetMulti(entry.client, kvItems),
            staticDataMulti(entry.client, uuids, STATIC_FIELDS),
          ]);

          setAgents((prev) => {
            const next = new Map(prev);

            if (meta.status === 'fulfilled' && meta.value) {
              const grouped = new Map<string, Record<string, unknown>>();
              for (const row of meta.value) {
                if (!row || row.value == null) continue;
                let bucket = grouped.get(row.namespace);
                if (!bucket) grouped.set(row.namespace, (bucket = {}));
                bucket[row.key] = row.value;
              }
              for (const uuid of uuids) {
                const cur = next.get(uuid) ?? blankAgent(uuid, entry.name);
                next.set(uuid, { ...cur, meta: parseMeta(grouped.get(uuid) ?? {}) });
              }
            }

            if (stat.status === 'fulfilled' && stat.value) {
              for (const row of stat.value) {
                if (!row.uuid) continue;
                const cur = next.get(row.uuid) ?? blankAgent(row.uuid, entry.name);
                next.set(row.uuid, { ...cur, static: row });
              }
            }
            return next;
          });
        })
      );

      await tickDynamic();
      setLoading(false);
    };

    const tickDynamic = async () => {
      const updates: DynamicSummary[] = [];
      await Promise.allSettled(
        poolInstance.entries.map(async (entry) => {
          const uuids = sourceUuids.get(entry.name) || [];
          if (!uuids.length) return;
          try {
            const rows = await dynamicSummaryMulti(entry.client, uuids, DYNAMIC_FIELDS);
            for (const row of rows || []) updates.push(row);
          } catch {
            /* ignore per-source tick errors */
          }
        })
      );
      if (!updates.length) return;

      setLive((prev) => {
        const next = new Map(prev);
        for (const row of updates) next.set(row.uuid, row);
        return next;
      });
      setHistory((prev) => {
        const next = new Map(prev);
        for (const row of updates) {
          const arr = next.get(row.uuid) || [];
          const sample = sampleFrom(row);
          const dedup = arr.length && arr[arr.length - 1].t === sample.t ? arr : arr.concat(sample);
          next.set(row.uuid, dedup.slice(-HISTORY_LIMIT));
        }
        return next;
      });
      // Also update tick to trigger re-render for online status
      setTick(t => t + 1);
    };

    bootstrap().catch((e: unknown) => {
      setErrors((prev) => [...prev, { source: '*', error: e }]);
      setLoading(false);
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') tickDynamic();
    };
    document.addEventListener('visibilitychange', onVisible);

    const dynTimer = setInterval(tickDynamic, DYN_INTERVAL_MS);
    const clockTimer = setInterval(() => setTick((t) => t + 1), 5000);

    return () => {
      clearInterval(dynTimer);
      clearInterval(clockTimer);
      document.removeEventListener('visibilitychange', onVisible);
      poolRef.current = null;
      setPool(null);
      poolInstance.close();
    };
  }, [config]);

  const nodes = useMemo(() => {
    const now = Date.now();
    const out: Node[] = [];
    for (const [uuid, a] of agents) {
      const dyn = live.get(uuid) || null;
      out.push({
        ...a,
        dynamic: dyn,
        history: history.get(uuid) || [],
        online: isOnline(dyn?.timestamp, now),
      });
    }
    // 在线优先，其次 metadata order，再按名称
    out.sort((a, b) => {
      if (a.online !== b.online) return b.online ? 1 : -1;
      if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
      return (a.meta.name || a.uuid).localeCompare(b.meta.name || b.uuid);
    });
    return out;
  }, [agents, live, history, tick]);

  return { nodes, errors, loading, pool };
}
