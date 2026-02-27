// ============================================================
// This Mind Does Not Exist — Reusable UI Components
// ============================================================
// Shared components used across the web app.
// Built with React 19, styled with Tailwind CSS + shadcn/ui patterns.
//
// Components:
//   - QueryInput: Text area with submit button for entering questions
//   - DebateViewer: Real-time debate display with Proposer/Skeptic columns
//   - RoundCard: Individual debate round display
//   - FinalAnswer: Synthesized answer with markdown rendering
//   - RatingWidget: 1-10 star/slider rating for trace quality
//   - DebateTimeline: Visual progress indicator for debate rounds
//   - ModelBadge: Display which model is active
//   - LoadingPulse: Animated "thinking" indicator
// ============================================================

// TODO: Implement each component
// Each component should:
//   1. Accept well-typed props
//   2. Use Tailwind CSS for styling
//   3. Support dark mode
//   4. Include animations for state transitions
//   5. Be accessible (proper ARIA labels, keyboard navigation)

export const COMPONENTS_MANIFEST = {
  QueryInput: 'Text area + submit button for entering reasoning questions',
  DebateViewer: 'Split-view real-time debate display (Proposer blue, Skeptic orange)',
  RoundCard: 'Card displaying one round of Proposer response + Skeptic critique',
  FinalAnswer: 'Polished final answer with markdown rendering and copy button',
  RatingWidget: '1-10 rating slider with quality labels',
  DebateTimeline: 'Horizontal timeline showing debate round progress',
  ModelBadge: 'Small badge showing active model name + status',
  LoadingPulse: 'Animated brain/pulse indicator while model is generating',
};
