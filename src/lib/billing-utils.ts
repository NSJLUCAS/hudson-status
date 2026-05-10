import type { Node } from '@/lib/nodeget-types';
import { hostNameLabel } from '@/lib/nodeget-utils';

export function nodeDisplayName(node: Node): string {
  return node.meta.name || hostNameLabel(node.static) || node.uuid.slice(0, 8);
}

/** 无独立字段时：首标签 > 虚拟化类型 */
export function serviceProvider(node: Node): string {
  const tags = node.meta.tags;
  if (tags?.length) return tags[0];
  return node.meta.virtualization || '—';
}
