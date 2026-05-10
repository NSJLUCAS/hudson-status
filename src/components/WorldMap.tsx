/** 全球节点地图（d3-geo + topojson），支持缩放、全屏与 nodehub 嵌入样式。 */
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopo from '@/data/world-110m.json';
import { Node } from '@/lib/nodeget-types';
import { hostNameLabel } from '@/lib/nodeget-utils';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, Plus, Minus, RotateCcw } from 'lucide-react';

interface WorldMapProps {
  nodes: Node[];
  onOpen?: (uuid: string) => void;
  selectedUuid?: string | null;
  nodehub?: boolean;
  compact?: boolean;
  showMapControls?: boolean;
}

const MAP_W = 900;
const MAP_H = 460;

const GREEN = 'rgb(66 185 131)';
const GRAY = 'rgb(148 163 184)';

function groupKey(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export function WorldMap({
  nodes,
  onOpen,
  selectedUuid = null,
  nodehub = false,
  compact = false,
  showMapControls = true,
}: WorldMapProps) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [browserFs, setBrowserFs] = useState(false);
  const dragging = useRef(false);

  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const resetView = useCallback(() => setView({ k: 1, x: 0, y: 0 }), []);

  useEffect(() => {
    const el = wrapRef.current;
    const onFs = () => setBrowserFs(!!el && document.fullscreenElement === el);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!browserFs) return;
    resetView();
  }, [browserFs, resetView]);

  function cancelClose() {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setHoverKey(null), 140);
  }

  const mapScale = useMemo(() => {
    if (browserFs) return 260;
    if (nodehub) return 220;
    if (compact) return 155;
    return 175;
  }, [browserFs, nodehub, compact]);

  const groups = useMemo(() => {
    const byPos = new Map<string, Node[]>();
    for (const n of nodes) {
      if (n.meta?.lat == null || n.meta?.lng == null) continue;
      const lat = n.meta.lat;
      const lng = n.meta.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const k = groupKey(lat, lng);
      const list = byPos.get(k);
      if (list) list.push(n);
      else byPos.set(k, [n]);
    }
    return [...byPos.entries()].map(([key, ns]) => ({
      key,
      lat: ns[0].meta.lat as number,
      lng: ns[0].meta.lng as number,
      nodes: ns,
    }));
  }, [nodes]);

  const total = groups.reduce((s, g) => s + g.nodes.length, 0);

  const { path, project } = useMemo(() => {
    const projection = geoEqualEarth()
      .scale(mapScale)
      .translate([MAP_W / 2, MAP_H / 2]);
    return {
      path: geoPath(projection),
      project: (lng: number, lat: number) => projection([lng, lat]) as [number, number],
    };
  }, [mapScale]);

  const countryPaths = useMemo(() => {
    let fc: GeoJSON.FeatureCollection | null = null;
    try {
      fc = feature(
        worldTopo as Parameters<typeof feature>[0],
        (worldTopo as { objects: { countries: unknown } }).objects.countries
      ) as GeoJSON.FeatureCollection;
    } catch {
      return [] as { key: string; d: string }[];
    }
    const feats = fc?.features ?? [];
    return feats.map((f, i) => ({
      key: `geo-${i}`,
      d: path(f as never) || '',
    }));
  }, [path]);

  const markers = useMemo(() => {
    return groups.map((g) => {
      const [x, y] = project(g.lng, g.lat);
      return { ...g, x, y };
    });
  }, [groups, project]);

  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const zoomPanTransform = `translate(${view.x},${view.y}) translate(${cx},${cy}) scale(${view.k}) translate(${-cx},${-cy})`;

  const mapWheelEngagedRef = useRef(false);

  const applyWheelZoom = useCallback((e: WheelEvent) => {
    if (!mapWheelEngagedRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.0015;
    setView((v) => ({
      ...v,
      k: Math.min(6, Math.max(0.35, v.k * (1 + delta))),
    }));
  }, []);

  const mapPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mapPaneRef.current;
    if (!el) return;
    el.addEventListener('wheel', applyWheelZoom, { passive: false });
    return () => el.removeEventListener('wheel', applyWheelZoom);
  }, [applyWheelZoom]);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => ({
      ...v,
      k: Math.min(6, Math.max(0.35, v.k * factor)),
    }));
  }, []);

  async function toggleBrowserFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }

  function onPanPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPanPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.movementX / rect.width) * MAP_W;
    const dy = (e.movementY / rect.height) * MAP_H;
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }

  function onPanPointerUp(e: React.PointerEvent) {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPanPointerCancel(e: React.PointerEvent) {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={wrapRef}
      className={cn(
        browserFs ? 'h-full w-full flex flex-col bg-background p-4' : '',
        !browserFs && 'rounded-lg border border-border bg-card p-3 sm:p-4',
        !browserFs && compact && 'p-2 sm:p-3',
        !browserFs && nodehub && showMapControls && 'px-0 py-2 sm:py-3',
        !browserFs && nodehub && !showMapControls && 'rounded-none border-0 bg-transparent p-0 shadow-none'
      )}
    >
      {showMapControls && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-between gap-2 mb-2',
            compact && 'mb-1.5'
          )}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {compact ? '节点地图' : '全球节点'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="缩小"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground hover:bg-muted/70"
              onClick={() => zoomBy(1 / 1.2)}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="放大"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground hover:bg-muted/70"
              onClick={() => zoomBy(1.2)}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="复位视图"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground hover:bg-muted/70"
              onClick={resetView}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title={browserFs ? '退出全屏' : '全屏地图'}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20"
              onClick={() => void toggleBrowserFullscreen()}
            >
              {browserFs ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{browserFs ? '退出' : '全屏'}</span>
            </button>
          </div>
        </div>
      )}

      <div
        ref={mapPaneRef}
        className={cn(
          'relative w-full overflow-hidden overscroll-contain text-foreground touch-none rounded-md border border-border/60 bg-background/40',
          browserFs ? 'flex-1 min-h-0 rounded-lg border border-border/60 bg-background/40' : '',
          !browserFs &&
            nodehub &&
            !showMapControls &&
            'rounded-none border-0 bg-transparent shadow-none ring-0',
          !browserFs &&
            nodehub &&
            'aspect-[900/460] max-h-[min(462px,42svh)] w-full min-h-[180px] md:aspect-auto md:max-h-none md:h-[462px]',
          !browserFs && !nodehub && 'aspect-[900/460]'
        )}
        onPointerDownCapture={(e) => {
          if (e.button === 0) mapWheelEngagedRef.current = true;
        }}
        onPointerLeave={() => {
          mapWheelEngagedRef.current = false;
        }}
        onClick={() => setHoverKey(null)}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="h-full w-full cursor-default select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
              <stop offset="55%" stopColor="var(--color-background)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-background)" stopOpacity="0.55" />
            </radialGradient>
            <filter id="dot-glow" x="-200%" y="-200%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={zoomPanTransform}>
            <rect
              x={0}
              y={0}
              width={MAP_W}
              height={MAP_H}
              fill="transparent"
              className="cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              onPointerDown={onPanPointerDown}
              onPointerMove={onPanPointerMove}
              onPointerUp={onPanPointerUp}
              onPointerCancel={onPanPointerCancel}
            />

            <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#map-grid)" pointerEvents="none" />

            {countryPaths.map(({ key, d }) => (
              <path
                key={key}
                d={d}
                fill="currentColor"
                fillOpacity={0.05}
                stroke="currentColor"
                strokeOpacity={0.22}
                strokeWidth={0.5}
                style={{ outline: 'none' }}
                pointerEvents="none"
              />
            ))}

            {markers.map((m) => {
              const isCluster = m.nodes.length > 1;
              const onlineCount = m.nodes.filter((n) => n.online).length;
              const color = onlineCount > 0 ? GREEN : GRAY;
              const isOpen = hoverKey === m.key;
              const isSelectedMarker =
                selectedUuid != null && m.nodes.some((n) => n.uuid === selectedUuid);
              const ringColor = isSelectedMarker ? 'var(--color-primary)' : color;
              const visualActive = isOpen || isSelectedMarker;

              return (
                <g
                  key={m.key}
                  transform={`translate(${m.x},${m.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    cancelClose();
                    setHoverKey(m.key);
                  }}
                  onMouseLeave={scheduleClose}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCluster && onOpen) onOpen(m.nodes[0].uuid);
                  }}
                >
                  <circle r={20} fill="transparent" />

                  <circle
                    r={visualActive ? 17 : 11}
                    fill="none"
                    stroke={ringColor}
                    strokeOpacity={visualActive ? 0.48 : 0.32}
                    strokeWidth={isSelectedMarker ? 1.35 : 1.15}
                    style={{ transition: 'r 0.25s ease' }}
                  />
                  <circle
                    r={visualActive ? 24 : 15}
                    fill="none"
                    stroke={ringColor}
                    strokeOpacity={visualActive ? 0.22 : 0.08}
                    strokeWidth="0.9"
                    style={{ transition: 'r 0.25s ease' }}
                  />

                  {onlineCount > 0 && (
                    <circle r={10} fill={ringColor} opacity={0.16}>
                      <animate attributeName="r" values="7;15;7" dur="2.4s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.28;0.02;0.28" dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  <circle
                    r={isCluster ? 8.5 : visualActive ? 5.2 : 4.2}
                    fill={isSelectedMarker ? 'var(--color-primary)' : color}
                    stroke="white"
                    strokeWidth={isCluster ? 1.3 : 1.1}
                    filter="url(#dot-glow)"
                  />

                  {isCluster && (
                    <text y={2.6} textAnchor="middle" fontSize={8.4} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>
                      {m.nodes.length}
                    </text>
                  )}

                  {isOpen && (
                    <MapNodePopover
                      nodes={m.nodes}
                      lat={m.lat}
                      lng={m.lng}
                      selectedUuid={selectedUuid}
                      onPick={(uuid) => {
                        setHoverKey(null);
                        if (onOpen) onOpen(uuid);
                      }}
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    />
                  )}
                </g>
              );
            })}
          </g>

          <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#map-vignette)" pointerEvents="none" />
        </svg>

        {total === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            加载节点地图
          </div>
        )}

      </div>
    </div>
  );
}

function mapPopoverLabel(n: Node): string {
  const name = n.meta.name?.trim() || hostNameLabel(n.static) || n.uuid.slice(0, 8);
  const region = n.meta.region?.trim() || '—';
  return `${name} · ${region}`;
}

function MapNodePopover({
  nodes,
  lat,
  lng,
  selectedUuid,
  onPick,
  onMouseEnter,
  onMouseLeave,
}: {
  nodes: Node[];
  lat: number;
  lng: number;
  selectedUuid?: string | null;
  onPick: (uuid: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const width = 240;
  const rowHeight = 34;
  const visibleRows = Math.min(nodes.length, 8);
  const height = visibleRows * rowHeight + 12;
  const gap = 14;

  let x = -width / 2;
  if (lng > 70) x = -width + gap;
  else if (lng < -70) x = -gap;

  const y = lat > 18 ? gap : -height - gap;

  return (
    <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'visible' }}>
      <div
        className="rounded-sm border border-border/90 bg-card/95 text-card-foreground shadow-[0_14px_30px_rgba(15,23,42,0.14)] backdrop-blur px-2 py-1 max-h-[320px] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {nodes.map((n, index) => (
          <button
            key={n.uuid}
            type="button"
            onClick={() => onPick(n.uuid)}
            className={cn(
              'w-full rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent/70',
              selectedUuid === n.uuid && 'bg-primary/12 ring-1 ring-inset ring-primary/35',
              index !== nodes.length - 1 && 'border-b border-dashed border-border/80'
            )}
          >
            <span className="block truncate text-xs font-semibold leading-snug text-foreground">
              {mapPopoverLabel(n)}
            </span>
          </button>
        ))}
      </div>
    </foreignObject>
  );
}
