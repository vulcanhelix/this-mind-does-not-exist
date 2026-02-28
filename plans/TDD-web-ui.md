# Technical Design Document — Web UI
## This Mind Does Not Exist — v0.1

**Component:** `apps/web/app/page.tsx` + components  
**Status:** Planning  
**Date:** 2026-02-27

---

## 1. Overview

The Web UI is the primary user-facing interface for interacting with the reasoning engine. Built with Next.js 15 (App Router), React 19, and Tailwind CSS, it provides:
- A clean query input interface
- Real-time streaming debate viewer (watch the Proposer ↔ Skeptic debate unfold)
- Final synthesized answer display
- Debates history browsing (traces)

---

## 2. Design Decisions

### 2.1 Next.js 15 App Router

We use the App Router because:
- **Server Components** — Reduce client-side JavaScript
- **Streaming** — Built-in support for streaming SSR
- **Layouts** — Share layouts across pages easily

### 2.2 Client-Side Streaming

The debate viewer connects to the SSE endpoint and renders events as they arrive. This requires:
- `EventSource` API for SSE consumption
- React state management for streaming content
- Scrolling synchronization (auto-scroll to latest content)

### 2.3 Component-Based Architecture

UI is broken into reusable components:
- `QueryInput` — Text area with submit
- `DebateViewer` — Container for streaming debate
- `RoundCard` — Individual round (Proposer + Skeptic)
- `FinalAnswer` — Synthesized result display
- `RatingWidget` — 1-10 star rating
- `DebateTimeline` — Visual progress indicator

---

## 3. Page Structure

```
/                           → Main query interface + debate viewer
/traces                     → Browse past debates
/traces/[id]               → View single debate transcript
/settings                   → Configuration (v0.2)
```

---

## 4. Component Specifications

### 4.1 QueryInput

```typescript
interface QueryInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function QueryInput({ onSubmit, disabled, placeholder }: QueryInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !disabled) {
      onSubmit(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-32 p-4 bg-gray-900 border border-gray-700 rounded-lg"
      />
      <button type="submit" disabled={disabled || !query.trim()}>
        Submit
      </button>
    </form>
  );
}
```

### 4.2 DebateViewer

```typescript
type DebateState = 'idle' | 'loading' | 'debating' | 'synthesizing' | 'complete' | 'error';

interface DebateViewerProps {
  traceId: string | null;
  onComplete?: (trace: DebateTrace) => void;
}

export function DebateViewer({ traceId, onComplete }: DebateViewerProps) {
  const [state, setState] = useState<DebateState>('idle');
  const [events, setEvents] = useState<DebateEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // SSE connection management
  useEffect(() => {
    if (!traceId) return;

    const eventSource = new EventSource(`/api/reason/${traceId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as DebateEvent;
      setEvents(prev => [...prev, data]);

      switch (data.type) {
        case 'rag_complete':
          setState('debating');
          break;
        case 'round_start':
          setState('debating');
          break;
        case 'proposer_chunk':
        case 'skeptic_chunk':
          setState('debating');
          break;
        case 'synthesis_start':
          setState('synthesizing');
          break;
        case 'complete':
          setState('complete');
          eventSource.close();
          onComplete?.(data.trace);
          break;
        case 'error':
          setState('error');
          setError(data.error);
          eventSource.close();
          break;
      }
    };

    return () => eventSource.close();
  }, [traceId]);

  // Render events
  return (
    <div className="space-y-4">
      {/* Timeline */}
      <DebateTimeline state={state} events={events} />

      {/* Rounds */}
      {events
        .filter(e => e.type === 'round_start')
        .map((roundEvent) => (
          <RoundCard
            key={roundEvent.round}
            round={roundEvent.round}
            proposerContent={getProposerContent(events, roundEvent.round)}
            skepticContent={getSkepticContent(events, roundEvent.round)}
          />
        ))}

      {/* Final Answer */}
      {events.some(e => e.type === 'synthesis_complete') && (
        <FinalAnswer content={getFinalAnswer(events)} />
      )}

      {/* Error */}
      {error && <ErrorDisplay error={error} />}
    </div>
  );
}
```

### 4.3 RoundCard

```typescript
interface RoundCardProps {
  round: number;
  proposerContent: string;
  skepticContent: string;
}

export function RoundCard({ round, proposerContent, skepticContent }: RoundCardProps) {
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-purple-900/30 px-4 py-2 border-b border-gray-700">
        <h3 className="font-semibold">Round {round}</h3>
      </div>
      
      {/* Proposer */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-400">🤖</span>
          <span className="font-medium text-purple-300">Proposer</span>
        </div>
        <div className="prose prose-invert">
          <MarkdownRenderer content={proposerContent} />
        </div>
      </div>

      {/* Skeptic */}
      <div className="p-4 bg-red-900/10 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400">🎯</span>
          <span className="font-medium text-red-300">Skeptic</span>
        </div>
        <div className="prose prose-invert">
          <MarkdownRenderer content={skepticContent} />
        </div>
      </div>
    </div>
  );
}
```

### 4.4 FinalAnswer

```typescript
interface FinalAnswerProps {
  content: string;
}

export function FinalAnswer({ content }: FinalAnswerProps) {
  return (
    <div className="border-2 border-green-500/50 rounded-lg p-6 bg-green-900/10">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">✨</span>
        <h2 className="text-xl font-bold text-green-400">Final Answer</h2>
      </div>
      <div className="prose prose-invert max-w-none">
        <MarkdownRenderer content={content} />
      </div>
      <RatingWidget />
    </div>
  );
}
```

### 4.5 DebateTimeline

```typescript
interface DebateTimelineProps {
  state: DebateState;
  events: DebateEvent[];
}

export function DebateTimeline({ state, events }: DebateTimelineProps) {
  const rounds = events.filter(e => e.type === 'round_start').length;
  const maxRounds = 5; // Could be from config

  const steps = [
    { label: 'RAG', complete: events.some(e => e.type === 'rag_complete') },
    { label: 'Debate', complete: state === 'complete' || state === 'synthesizing' },
    { label: 'Synthesis', complete: events.some(e => e.type === 'synthesis_complete') },
  ];

  return (
    <div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className={`flex items-center gap-2 ${step.complete ? 'text-green-400' : 'text-gray-500'}`}>
            <span>{step.complete ? '✓' : '○'}</span>
            <span>{step.label}</span>
          </div>
          {i < steps.length - 1 && <span className="text-gray-600">→</span>}
        </React.Fragment>
      ))}
      
      {state === 'debating' && (
        <span className="ml-auto text-yellow-400 animate-pulse">
          Round {rounds + 1}/{maxRounds}...
        </span>
      )}
    </div>
  );
}
```

### 4.6 RatingWidget

```typescript
interface RatingWidgetProps {
  traceId: string;
}

export function RatingWidget({ traceId }: RatingWidgetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitRating = async (value: number) => {
    await fetch(`/api/traces/${traceId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: value }),
    });
    setRating(value);
    setSubmitted(true);
  };

  if (submitted) {
    return <div className="text-green-400">Thanks for your feedback!</div>;
  }

  return (
    <div className="flex gap-2 mt-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
        <button
          key={value}
          onClick={() => submitRating(value)}
          className={`w-8 h-8 rounded ${rating === value ? 'bg-yellow-500' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
```

---

## 5. Page Implementation

### 5.1 Main Page (page.tsx)

```typescript
'use client';

import { useState } from 'react';
import { QueryInput } from '@/components/query-input';
import { DebateViewer } from '@/components/debate-viewer';

export default function HomePage() {
  const [traceId, setTraceId] = useState<string | null>(null);

  const handleQuerySubmit = async (query: string) => {
    // Start debate
    const response = await fetch('/api/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const { traceId } = await response.json();
    setTraceId(traceId);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-center mb-8">
          This Mind Does Not Exist
        </h1>

        {!traceId ? (
          <QueryInput onSubmit={handleQuerySubmit} />
        ) : (
          <DebateViewer
            traceId={traceId}
            onComplete={(trace) => console.log('Debate complete:', trace)}
          />
        )}
      </div>
    </main>
  );
}
```

---

## 6. Test Specifications

**Test file:** `apps/web/app/__tests__/page.test.tsx`  
**Framework:** Vitest + React Testing Library

### 6.1 QueryInput Tests

```typescript
describe('QueryInput', () => {
  it('should call onSubmit with query when submitted', async () => {
    // Arrange
    const onSubmit = vi.fn();
    render(<QueryInput onSubmit={onSubmit} />);
    
    // Act
    await userEvent.type(screen.getByRole('textbox'), 'My question');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    // Assert
    expect(onSubmit).toHaveBeenCalledWith('My question');
  });

  it('should disable submit when disabled prop is true', () => {
    // Assert: Button is disabled
  });

  it('should clear input after submission', async () => {
    // Assert: Text area is cleared
  });
});
```

### 6.2 DebateViewer Tests

```typescript
describe('DebateViewer', () => {
  it('should show loading state initially', () => {
    // Assert: Loading indicator shown
  });

  it('should connect to SSE endpoint when traceId is set', () => {
    // Assert: EventSource created with correct URL
  });

  it('should render rounds as they complete', async () => {
    // Arrange: Mock SSE to emit round events
    // Assert: RoundCard rendered for each round
  });

  it('should render final answer after synthesis', async () => {
    // Assert: FinalAnswer component shown
  });

  it('should handle error events gracefully', async () => {
    // Assert: Error message displayed
  });
});
```

### 6.3 RoundCard Tests

```typescript
describe('RoundCard', () => {
  it('should display round number', () => {
    // Assert: "Round 1" heading shown
  });

  it('should display proposer content with correct styling', () => {
    // Assert: Purple theme applied
  });

  it('should display skeptic content with correct styling', () => {
    // Assert: Red theme applied
  });

  it('should render markdown content', () => {
    // Assert: MarkdownRenderer renders formatted content
  });
});
```

### 6.4 Integration Tests

```typescript
describe('End-to-End Flow', () => {
  it('should submit query and display streaming debate', async () => {
    // Arrange: Mock API to return trace ID, mock SSE to stream events
    // Act: User submits query
    // Assert: Debate viewer shows streaming content
  });

  it('should display final answer after debate completes', async () => {
    // Assert: FinalAnswer rendered with content
  });

  it('should allow rating after completion', async () => {
    // Assert: RatingWidget allows submission
  });
});
```

---

## 7. File Structure

```
apps/web/
├── app/
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                   # Root layout
│   ├── traces/
│   │   ├── page.tsx                 # Traces list page
│   │   └── [id]/
│   │       └── page.tsx             # Trace detail page
│   └── settings/
│       └── page.tsx                 # Settings page (v0.2)
├── components/
│   ├── query-input.tsx
│   ├── debate-viewer.tsx
│   ├── round-card.tsx
│   ├── final-answer.tsx
│   ├── rating-widget.tsx
│   ├── debate-timeline.tsx
│   └── markdown-renderer.tsx
├── lib/
│   └── api.ts                      # API client functions
├── __tests__/
│   ├── page.test.tsx
│   └── components/
└── package.json
```

---

## 8. Acceptance Criteria

- [ ] All component and integration tests pass
- [ ] Query input accepts and validates user queries
- [ ] Debate starts when query is submitted
- [ ] SSE events are consumed and displayed in real-time
- [ ] Proposer and Skeptic responses are visually distinct
- [ ] Each round is clearly labeled
- [ ] Final answer is prominently displayed
- [ ] Rating widget allows 1-10 rating
- [ ] Timeline shows debate progress
- [ ] Error states are handled gracefully
- [ ] Markdown is rendered correctly
- [ ] Auto-scroll works during streaming
