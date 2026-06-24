import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { PhTrendPoint, PhPrediction } from '../../types'

// ── Source metadata ───────────────────────────────────────────────────────────

export const SOURCE_META: Record<string, { label: string; color: string; desc: string }> = {
  hot:           { label: 'HOT / Station ALOHA', color: '#0ea5e9', desc: 'Observed · Open ocean NE of Oahu · 1988–present' },
  cmems:         { label: 'CMEMS (Copernicus)',   color: '#8b5cf6', desc: 'Modeled · Global biogeochemistry reanalysis' },
  ipacoa:        { label: 'IPACOA',              color: '#10b981', desc: 'Observed · Nearshore buoy network · patchy' },
  dar_reef_check: { label: 'DAR / Reef Check',   color: '#f59e0b', desc: 'Observed · Survey snapshots · manual import' },
}

// ── Raw Data chart ─────────────────────────────────────────────────────────────

interface RawChartProps {
  data: PhTrendPoint[]
  activeSources: string[]
}

type RawRow = { date: string } & Record<string, number | undefined>

function buildRawRows(data: PhTrendPoint[], sources: string[]): RawRow[] {
  const map = new Map<string, RawRow>()
  for (const pt of data) {
    if (!sources.includes(pt.source)) continue
    if (!map.has(pt.date)) map.set(pt.date, { date: pt.date })
    map.get(pt.date)![pt.source] = pt.avg_ph
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function PhRawChart({ data, activeSources }: RawChartProps) {
  const rows = buildRawRows(data, activeSources)

  if (rows.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        No pH data available for the selected sources.
        <br />Import data using the Upload tab below.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          interval={Math.max(0, Math.floor(rows.length / 10) - 1)}
        />
        <YAxis
          domain={[7.7, 8.4]}
          tick={{ fontSize: 11 }}
          tickFormatter={v => v.toFixed(2)}
          label={{ value: 'pH', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11 }}
        />
        <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={l => `Month: ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={8.18} stroke="#6b7280" strokeDasharray="4 2"
          label={{ value: 'Pre-industrial ~8.18', fontSize: 9, fill: '#6b7280', position: 'right' }} />
        {activeSources.map(src => (
          <Line
            key={src}
            type="monotone"
            dataKey={src}
            name={SOURCE_META[src]?.label ?? src}
            stroke={SOURCE_META[src]?.color ?? '#888'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Prediction chart ───────────────────────────────────────────────────────────

interface PredChartProps {
  prediction: PhPrediction
  rawHot: PhTrendPoint[]
}

type PredRow = {
  date: string
  observed: number | null
  trend: number | null
  forecast: number | null
  lower: number | null
  ci_width: number | null
}

function buildPredRows(prediction: PhPrediction, rawHot: PhTrendPoint[]): PredRow[] {
  const hotMap = new Map(rawHot.filter(p => p.source === 'hot').map(p => [p.date, p.avg_ph]))

  const rows: PredRow[] = prediction.trend.map(p => ({
    date: p.date,
    observed: hotMap.get(p.date) ?? null,
    trend: p.ph,
    forecast: null,
    lower: p.lower,
    ci_width: p.lower !== null && p.upper !== null ? +(p.upper - p.lower).toFixed(4) : null,
  }))

  for (const p of prediction.forecast) {
    rows.push({
      date: p.date,
      observed: null,
      trend: null,
      forecast: p.ph,
      lower: p.lower,
      ci_width: p.lower !== null && p.upper !== null ? +(p.upper - p.lower).toFixed(4) : null,
    })
  }

  return rows
}

export function PhPredictionChart({ prediction, rawHot }: PredChartProps) {
  const rows = buildPredRows(prediction, rawHot)
  const lastHistorical = prediction.trend[prediction.trend.length - 1]?.date

  return (
    <div>
      {prediction.r_squared !== null && (
        <p className="text-xs text-gray-500 mb-2">
          Model fit R² = <strong>{prediction.r_squared.toFixed(3)}</strong> · Linear trend + annual seasonal cycle · Fitted to HOT Station ALOHA data
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            interval={Math.max(0, Math.floor(rows.length / 10) - 1)}
          />
          <YAxis
            domain={[7.7, 8.4]}
            tick={{ fontSize: 11 }}
            tickFormatter={v => v.toFixed(2)}
            label={{ value: 'pH', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11 }}
          />
          <Tooltip
            formatter={(v: number, name: string) => [v.toFixed(4), name]}
            labelFormatter={l => `Month: ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Confidence interval band: stack transparent base + colored band */}
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="none"
            stackId="ci"
            legendType="none"
            tooltipType="none"
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="ci_width"
            name="95% CI"
            stroke="none"
            fill="#0ea5e9"
            fillOpacity={0.12}
            stackId="ci"
            legendType="square"
            activeDot={false}
          />

          {lastHistorical && (
            <ReferenceLine
              x={lastHistorical}
              stroke="#9ca3af"
              strokeDasharray="3 3"
              label={{ value: 'Forecast →', fontSize: 10, fill: '#9ca3af', position: 'insideTopRight' }}
            />
          )}

          <Line
            type="monotone"
            dataKey="observed"
            name="HOT Observed"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="Model Trend"
            stroke="#0ea5e9"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
