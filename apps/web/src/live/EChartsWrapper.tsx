'use client';

/**
 * Thin wrapper around echarts-for-react that resolves the React 19 JSX
 * compatibility issue in echarts-for-react's type declarations.
 *
 * Uses forwardRef so callers can access getEchartsInstance() when needed
 * (e.g. for echarts.connect group sync).
 */
import EChartsReact from 'echarts-for-react';
import { forwardRef } from 'react';

type EChartsProps = {
  option: object;
  style?: React.CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents?: Record<string, (params: any) => void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EChartsAny = EChartsReact as any;

export const EChart = forwardRef<EChartsReact, EChartsProps>((props, ref) => (
  <EChartsAny ref={ref} {...props} />
));
EChart.displayName = 'EChart';
