import { useMemo } from 'react'
import { SegmentedControl } from '../components/SegmentedControl'
import { usePhData } from '../../hooks/usePhData'
import { PhRawChart, PhPredictionChart } from '../../components/Charts/PhChart'

export function OceanPhScreen() {
  const {
    mode, setMode, selectedSources, trendData, prediction,
    sourceInfo, loadingTrend, loadingPrediction,
  } = usePhData(30)

  const hotPoints = useMemo(
    () => trendData.filter(p => p.source === 'hot').sort((a, b) => a.date.localeCompare(b.date)),
    [trendData]
  )
  const currentPh = hotPoints.length ? hotPoints[hotPoints.length - 1].avg_ph : null
  const sinceChange = hotPoints.length > 1 ? hotPoints[hotPoints.length - 1].avg_ph - hotPoints[0].avg_ph : null
  const hotInfo = sourceInfo.find(s => s.source === 'hot')

  return (
    <div className="h-full overflow-y-auto px-5 pt-3" style={{ paddingBottom: 100 }}>
      <h2 className="serif text-[27px] font-medium" style={{ color: 'var(--k-ink)' }}>Ocean pH</h2>
      <p className="text-[13px] mt-0.5 mb-4" style={{ color: 'var(--k-sub)' }}>
        {hotInfo ? `Open-ocean station · ${hotInfo.count} records · ${hotInfo.earliest?.slice(0, 4)}–present.` : 'Open-ocean station data.'}
      </p>

      <SegmentedControl
        options={[{ value: 'raw', label: 'Trend' }, { value: 'prediction', label: 'Forecast' }]}
        value={mode}
        onChange={setMode}
      />

      <div className="rounded-2xl border p-4 mt-4" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
        {mode === 'raw' ? (
          loadingTrend ? (
            <div className="text-center text-[12.5px] py-8" style={{ color: 'var(--k-sub)' }}>Loading…</div>
          ) : (
            <PhRawChart data={trendData} activeSources={selectedSources} />
          )
        ) : loadingPrediction || !prediction ? (
          <div className="text-center text-[12.5px] py-8" style={{ color: 'var(--k-sub)' }}>Loading forecast…</div>
        ) : (
          <PhPredictionChart prediction={prediction} rawHot={trendData} />
        )}
      </div>

      <div className="flex gap-2.5 mt-4">
        <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div className="serif text-[23px]" style={{ color: 'var(--k-ink)' }}>{currentPh != null ? currentPh.toFixed(2) : '—'}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Current pH</div>
        </div>
        <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div className="serif text-[23px]" style={{ color: sinceChange != null && sinceChange < 0 ? '#DC2626' : 'var(--k-ink)' }}>
            {sinceChange != null ? `${sinceChange > 0 ? '+' : ''}${sinceChange.toFixed(2)}` : '—'}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Since {hotInfo?.earliest?.slice(0, 4) ?? 'start'}</div>
        </div>
        <div className="flex-1 rounded-2xl border p-3.5 text-center" style={{ background: 'var(--k-card)', borderColor: 'var(--k-border)' }}>
          <div className="serif text-[23px]" style={{ color: '#0f766e' }}>{hotInfo?.count ?? '—'}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--k-sub)' }}>Records</div>
        </div>
      </div>

      <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--k-panel)' }}>
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: '#8ccfd6' }}>What this means</div>
        <div className="serif text-[15px] leading-[1.6]" style={{ color: '#e2e8f0' }}>
          Surface waters have grown measurably more acidic since monitoring began — a slow strain on the reefs&rsquo; ability to build skeleton.
        </div>
      </div>
    </div>
  )
}
