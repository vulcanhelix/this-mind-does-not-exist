// ============================================================
// This Mind Does Not Exist — Trace Detail Page
// ============================================================
// View a specific debate transcript with full round-by-round
// Proposer/Skeptic exchange and final synthesized answer.
// ============================================================

export default function TraceDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Trace: {params.id}</h1>
      {/* TODO: Fetch trace from /api/traces/:id */}
      {/* TODO: Render debate rounds (Proposer blue, Skeptic orange) */}
      {/* TODO: Render final synthesized answer */}
      {/* TODO: Show rating widget */}
      <div className="text-gray-500 text-center py-20">
        <p>🔍 Trace detail view coming soon</p>
      </div>
    </div>
  );
}
