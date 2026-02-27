// ============================================================
// This Mind Does Not Exist — Main Page
// ============================================================
// Home page with the query input, debate viewer, and final
// answer display. This is where the magic happens.
//
// Components used:
//   - QueryInput: Text area for entering questions
//   - DebateViewer: Real-time debate display (Proposer vs Skeptic)
//   - FinalAnswer: Synthesized answer with rating widget
//   - DebateTimeline: Visual timeline of debate rounds
//
// State Flow:
//   Idle → Loading → Debating → Synthesizing → Complete
// ============================================================

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center pt-20 pb-10">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          This Mind Does Not Exist
        </h1>
        <p className="mt-4 text-gray-400 text-lg">
          Frontier reasoning that doesn&apos;t exist… until you run it locally.
        </p>
      </section>

      {/* Query Input */}
      <section className="max-w-4xl mx-auto px-6">
        {/* TODO: Implement QueryInput component */}
        {/* TODO: Implement streaming debate viewer */}
        {/* TODO: Implement final answer display */}
        {/* TODO: Implement rating widget */}
        <div className="text-center text-gray-500 py-20">
          <p>🧠 Query interface coming soon</p>
          <p className="text-sm mt-2">
            This is the placeholder for the beautiful reasoning UI.
          </p>
        </div>
      </section>
    </div>
  );
}
