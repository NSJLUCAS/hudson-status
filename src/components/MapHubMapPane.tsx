import type { Node } from '@/lib/nodeget-types';
import { WorldMap } from '@/components/WorldMap';

/**
 * /nodehub 地图区：与首页侧栏地图分开实现。
 * WorldMap `nodehub` 自带固定宽高比盒子；此处用文档流包裹，整页滚动时不必依赖父级 flex 高度。
 */
export function MapHubMapPane({
  nodes,
  selectedUuid,
  onSelectNode,
}: {
  nodes: Node[];
  selectedUuid: string | null;
  onSelectNode: (uuid: string) => void;
}) {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-[0.02]" />

      <div className="relative w-full">
        <WorldMap
          nodes={nodes}
          selectedUuid={selectedUuid}
          onOpen={onSelectNode}
          nodehub
          showMapControls={false}
        />
      </div>
    </div>
  );
}
