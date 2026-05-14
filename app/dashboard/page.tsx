import { FollowerGrowthChart } from '@/components/dashboard/follower-growth-chart'
import { WeeklyEngagementChart } from '@/components/dashboard/weekly-engagement-chart'
import { TotalEngagementChart } from '@/components/dashboard/total-engagement-chart'

export default function DashboardPage() {
  return (
    <main className="p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground text-balance">Overview</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Social media analytics across all candidates and platforms.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FollowerGrowthChart />
        <WeeklyEngagementChart />
      </div>
      <TotalEngagementChart />
    </main>
  )
}
