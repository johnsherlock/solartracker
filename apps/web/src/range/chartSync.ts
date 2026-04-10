/**
 * Explicit dataZoom sync for the range-history ECharts group.
 *
 * echarts.connect() handles group sync reliably for mouse-wheel and slider
 * interactions on desktop, but touch-based inside dataZoom on mobile does not
 * consistently propagate through the group. This module keeps its own instance
 * registry so any chart can explicitly broadcast its zoom state to peers.
 */

import type * as echartsTypes from 'echarts';

type EChartsInstance = ReturnType<typeof echartsTypes.init>;

const registry = new Map<string, Set<EChartsInstance>>();

/** Register an instance and return a cleanup function that unregisters it. */
export function registerChart(group: string, instance: EChartsInstance): () => void {
  if (!registry.has(group)) registry.set(group, new Set());
  registry.get(group)!.add(instance);
  return () => registry.get(group)?.delete(instance);
}

// Guard against re-entrant broadcasts: when we dispatch to chart B, ECharts
// fires a dataZoom event on B which would call broadcastDataZoom again,
// cascading back to A and creating an infinite loop of conflicting dispatches.
let _broadcasting = false;

/**
 * Dispatch a dataZoom action to every registered instance in the group except
 * the source that triggered the event.
 */
export function broadcastDataZoom(
  group: string,
  source: EChartsInstance,
  start: number,
  end: number,
): void {
  if (_broadcasting) return;
  _broadcasting = true;
  try {
    registry.get(group)?.forEach((inst) => {
      if (inst === source) return;
      inst.dispatchAction({ type: 'dataZoom', start, end });
    });
  } finally {
    _broadcasting = false;
  }
}
