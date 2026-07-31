export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-80 bg-muted/60 rounded-md" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-card border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="w-8 h-8 rounded-lg bg-muted" />
            </div>
            <div className="h-7 w-16 bg-muted rounded-md" />
            <div className="h-3 w-32 bg-muted/50 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-56 w-full bg-muted/40 rounded-xl" />
        </div>
        <div className="h-80 rounded-2xl bg-card border border-border p-5 space-y-4">
          <div className="h-5 w-40 bg-muted rounded" />
          <div className="h-56 w-full bg-muted/40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
