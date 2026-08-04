import type { CSSProperties } from 'react'
import { useTheme } from '../context/ThemeContext'

/**
 * Recharts takes colors as props, not CSS, so it can't inherit our dark-mode classes.
 * These are the grid/axis/tooltip colors every chart should use so charts stay legible
 * in both themes — on the desktop panels and in the mobile detail screen.
 */
export interface ChartTheme {
  dark: boolean
  grid: string
  axis: string
  muted: string
  tooltip: CSSProperties
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    grid: dark ? '#334155' : '#e5e7eb',
    axis: dark ? '#94a3b8' : '#6b7280',
    muted: dark ? '#64748b' : '#9ca3af',
    tooltip: {
      fontSize: 11,
      background: dark ? '#1e293b' : '#ffffff',
      border: `1px solid ${dark ? '#334155' : '#e5e7eb'}`,
      borderRadius: 8,
      color: dark ? '#e2e8f0' : '#1f2937',
    },
  }
}
