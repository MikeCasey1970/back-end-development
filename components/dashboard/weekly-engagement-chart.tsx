'use client'

import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { WeeklyEngagementRow } from '@/types/analytics'

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

export function WeeklyEngagementChart() {
  const { data, error, isLoading } = useSWR<WeeklyEngagementRow[]>('/api/analytics/weekly-engagement', fetcher)
  const rows = Array.isArray(data) ? data : []

  if (isLoading) return <ChartCard title="Weekly Engagement"><div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div></ChartCard>
  if (error) return <ChartCard title="Weekly Engagement"><div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Failed to load data.</div></ChartCard>

  const candidates = [...new Set(rows.map(d => d.candidate_name))]
  const weekMap: Record<string, Record<string, number>> = {}
  rows.forEach(row => {
    const week = row.week_start.slice(0, 10)
    if (!weekMap[week]) weekMap[week] = { week }
    weekMap[week][row.candidate_name] = row.total_engagement
  })
  const chartData = Object.values(weekMap).sort((a, b) => String(a.week).localeCompare(String(b.week)))

  return (
    <ChartCard title="Weekly Engagement">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="week" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 6 }} />
          <Legend />
          {candidates.map((c, i) => (
            <Bar key={c} dataKey={c} fill={COLORS[i % COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
