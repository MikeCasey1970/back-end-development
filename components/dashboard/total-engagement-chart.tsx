'use client'

import useSWR from 'swr'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { CumulativeEngagementRow } from '@/types/analytics'

const fetcher = (url: string) => fetch(url).then(r => r.json())
const COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)']

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export function TotalEngagementChart() {
  const { data, error, isLoading } = useSWR<CumulativeEngagementRow[]>('/api/analytics/total-engagement', fetcher)
  const rows = Array.isArray(data) ? data : []

  if (isLoading) return <ChartCard title="Cumulative Engagement"><div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Loading...</div></ChartCard>
  if (error) return <ChartCard title="Cumulative Engagement"><div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Failed to load data.</div></ChartCard>

  const candidates = [...new Set(rows.map(d => d.candidate_name))]
  const dateMap: Record<string, Record<string, number>> = {}
  rows.forEach(row => {
    const date = row.activity_date.slice(0, 10)
    if (!dateMap[date]) dateMap[date] = { date }
    dateMap[date][row.candidate_name] = row.cumulative_engagement
  })
  const chartData = Object.values(dateMap).sort((a, b) => String(a.date).localeCompare(String(b.date)))

  return (
    <ChartCard title="Cumulative Engagement">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6 }} />
          <Legend />
          {candidates.map((c, i) => (
            <Area key={c} type="monotone" dataKey={c} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
