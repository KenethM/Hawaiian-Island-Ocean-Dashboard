import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ReferenceLine, ReferenceDot, Label, ResponsiveContainer,
} from 'recharts'
import type { TidePrediction, TideHighLow } from '../../types'

interface Props {
  predictions: TidePrediction[]
  highLows: TideHighLow[]
  currentTime: string  // "YYYY-MM-DD HH:MM"
}

export function TideChart({ predictions, highLows, currentTime }: Props) {
  const currentLabel = currentTime.slice(11, 16)
  const data = predictions.map(p => ({
    label: p.time.slice(11, 16),
    height: p.height_m,
  }))

  return (
    <ResponsiveContainer width="100%" height={90}>
      <AreaChart data={data} margin={{ top: 14, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          interval={5}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#94a3b8' }}
          domain={['auto', 'auto']}
          tickCount={3}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(2)} m`, 'Height']}
          labelFormatter={l => `Time (UTC): ${l}`}
          contentStyle={{ fontSize: 11 }}
        />

        <Area
          type="monotone"
          dataKey="height"
          stroke="#0284c7"
          strokeWidth={1.5}
          fill="url(#tideGrad)"
          dot={false}
          isAnimationActive={false}
        />

        {currentLabel && (
          <ReferenceLine
            x={currentLabel}
            stroke="#64748b"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        )}

        {highLows.map((hl, i) => (
          <ReferenceDot
            key={i}
            x={hl.time.slice(11, 16)}
            y={hl.height_m}
            r={3.5}
            fill={hl.type === 'H' ? '#0284c7' : '#94a3b8'}
            stroke="#fff"
            strokeWidth={1}
          >
            <Label
              value={`${hl.type} ${hl.height_m.toFixed(1)}m`}
              position={hl.type === 'H' ? 'top' : 'bottom'}
              style={{ fontSize: 9, fill: hl.type === 'H' ? '#0284c7' : '#64748b' }}
            />
          </ReferenceDot>
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
