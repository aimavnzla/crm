export function CallQueueSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando cola de llamadas">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="aima-card border-aima-border rounded-xl p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-4 w-32 bg-aima-border rounded" />
            <div className="h-3 w-24 bg-aima-border rounded ml-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-10 bg-aima-border rounded" />
            ))}
          </div>
          <div className="h-6 w-3/4 bg-aima-border rounded" />
        </div>
      ))}
    </div>
  );
}