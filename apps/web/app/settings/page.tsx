// ============================================================
// This Mind Does Not Exist — Settings Page
// ============================================================
// Configure the reasoning engine:
//   - Model selection (Proposer, Skeptic, Synthesizer)
//   - Debate parameters (rounds, temperature)
//   - RAG settings (top-k, threshold)
//   - Fine-tuning options
// ============================================================

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>
      {/* TODO: Model selection dropdowns (fetch from /api/models) */}
      {/* TODO: Debate configuration sliders */}
      {/* TODO: RAG configuration */}
      {/* TODO: Fine-tuning toggles and schedules */}
      <div className="text-gray-500 text-center py-20">
        <p>⚙️ Settings panel coming soon</p>
      </div>
    </div>
  );
}
