'use client';

/**
 * Thin wrapper around echarts-for-react that resolves the React 19 JSX
 * compatibility issue in echarts-for-react's type declarations.
 */
import EChartsReact from 'echarts-for-react';
import type { ComponentType } from 'react';

type EChartsProps = {
  option: object;
  style?: React.CSSProperties;
  notMerge?: boolean;
  lazyUpdate?: boolean;
};

// Cast once here so every consumer gets a correctly-typed React 19 component.
export const EChart = EChartsReact as unknown as ComponentType<EChartsProps>;
