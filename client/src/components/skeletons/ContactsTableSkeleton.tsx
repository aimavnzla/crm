export function ContactsTableSkeleton() {
  return (
    <div className="aima-card border-aima-border rounded-xl overflow-hidden animate-pulse">
      <div className="p-4 border-b border-aima-border">
        <div className="h-6 w-48 bg-aima-border rounded" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-aima-bg">
              {[...Array(8)].map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-4 w-20 bg-aima-border rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, row) => (
              <tr key={row} className="border-t border-aima-border">
                {[...Array(8)].map((_, col) => (
                  <td key={col} className="px-4 py-3">
                    <div className="h-4 w-24 bg-aima-border rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-aima-border">
        <div className="h-8 w-32 bg-aima-border rounded" />
      </div>
    </div>
  );
}