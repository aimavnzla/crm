export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Tarjetas de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="aima-card border-aima-border rounded-xl p-6 space-y-3">
            <div className="h-4 w-32 bg-aima-border rounded" />
            <div className="h-12 w-24 bg-aima-border rounded" />
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-8 bg-aima-border rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desglose por país */}
      <div className="aima-card border-aima-border rounded-xl p-6">
        <div className="h-6 w-40 bg-aima-border rounded mb-4" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[...Array(7)].map((_, i) => (
                  <th key={i} className="px-4 py-2">
                    <div className="h-4 w-16 bg-aima-border rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, row) => (
                <tr key={row} className="border-t border-aima-border">
                  {[...Array(7)].map((_, col) => (
                    <td key={col} className="px-4 py-2">
                      <div className="h-4 w-16 bg-aima-border rounded" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico líneas */}
      <div className="aima-card border-aima-border rounded-xl p-6">
        <div className="h-6 w-40 bg-aima-border rounded mb-4" />
        <div className="h-64 bg-aima-border rounded" />
      </div>
    </div>
  );
}