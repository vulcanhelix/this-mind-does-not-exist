'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Copy, Check, Star, Loader2, Brain, MessageSquare, Sparkles } from 'lucide-react';

type DebateState = 'idle' | 'loading' | 'debating' | 'synthesizing' | 'complete' | 'error';

interface DebateEvent {
  type: string;
  round?: number;
  content?: string;
  durationMs?: number;
  templates?: any[];
  trace?: any;
  error?: string;
}

interface Round {
  round: number;
  proposerResponse: string;
  skepticResponse: string;
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<DebateState>('idle');
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [traceId, setTraceId] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [templatesUsed, setTemplatesUsed] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || state !== 'idle') return;

    setState('loading');
    setRounds([]);
    setFinalAnswer('');
    setCurrentRound(0);
    setError('');
    setRating(null);
    setTemplatesUsed([]);

    try {
      // Start debate
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error('Failed to start debate');
      }

      const { traceId: newTraceId } = await response.json();
      setTraceId(newTraceId);

      // Connect to SSE stream
      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/reason/${newTraceId}/stream`
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data: DebateEvent = JSON.parse(event.data);
          handleDebateEvent(data);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        setState('error');
        setError('Connection lost');
        eventSource.close();
      };

    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDebateEvent = (data: DebateEvent) => {
    switch (data.type) {
      case 'rag_complete':
        setTemplatesUsed(data.templates?.map((t: any) => t.name) || []);
        setState('debating');
        break;
        
      case 'round_start':
        setCurrentRound(data.round || 0);
        break;
        
      case 'proposer_chunk':
        setState('debating');
        // We could update a "current proposer response" state here
        break;
        
      case 'skeptic_chunk':
        setState('debating');
        // We could update a "current skeptic response" state here
        break;
        
      case 'skeptic_complete':
        // Add completed round
        setRounds(prev => [...prev, {
          round: data.round || 0,
          proposerResponse: '', // Would need to track this separately
          skepticResponse: data.content || '',
        }]);
        break;
        
      case 'synthesis_start':
        setState('synthesizing');
        break;
        
      case 'synthesis_chunk':
        setFinalAnswer(prev => prev + (data.content || ''));
        break;
        
      case 'synthesis_complete':
        setState('complete');
        break;
        
      case 'complete':
        setState('complete');
        if (data.trace) {
          setFinalAnswer(data.trace.finalAnswer);
          setRounds(data.trace.rounds || []);
        }
        break;
        
      case 'error':
        setState('error');
        setError(data.error || 'Debate failed');
        break;
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(finalAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitRating = async (score: number) => {
    if (!traceId) return;
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/traces/${traceId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score }),
      });
      setRating(score);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center pt-20 pb-10">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          This Mind Does Not Exist
        </h1>
        <p className="mt-4 text-gray-400 text-lg">
          Frontier reasoning that doesn't exist… until you run it locally.
        </p>
      </section>

      {/* Query Input */}
      <section className="max-w-4xl mx-auto px-6 mb-8">
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything... (e.g., 'Prove that √2 is irrational')"
            className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            disabled={state !== 'idle'}
          />
          <button
            type="submit"
            disabled={!query.trim() || state !== 'idle'}
            className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {state === 'idle' ? <Send size={18} /> : <Loader2 size={18} className="animate-spin" />}
            {state === 'idle' ? 'Reason' : state === 'loading' ? 'Starting...' : 'Reasoning...'}
          </button>
        </form>

        {/* State indicators */}
        {state !== 'idle' && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            {state === 'loading' && <span className="text-yellow-400">🔍 Finding reasoning templates...</span>}
            {state === 'debating' && <span className="text-purple-400">💬 Round {currentRound} debate in progress...</span>}
            {state === 'synthesizing' && <span className="text-green-400">✨ Synthesizing final answer...</span>}
            {state === 'complete' && <span className="text-green-400">✅ Complete!</span>}
            {state === 'error' && <span className="text-red-400">❌ {error}</span>}
          </div>
        )}
      </section>

      {/* Debate Viewer */}
      {(state === 'debating' || state === 'synthesizing' || state === 'complete') && (
        <section className="max-w-5xl mx-auto px-6 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <MessageSquare className="text-purple-400" />
            Debate Progress
          </h2>
          
          {/* Templates used */}
          {templatesUsed.length > 0 && (
            <div className="mb-4 p-3 bg-gray-800 rounded-lg">
              <span className="text-gray-400 text-sm">Templates used: </span>
              {templatesUsed.map((t, i) => (
                <span key={i} className="inline-block bg-purple-900 text-purple-300 px-2 py-1 rounded text-sm mr-2">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Rounds */}
          <div className="space-y-4">
            {rounds.map((round) => (
              <div key={round.round} className="bg-gray-900 rounded-xl overflow-hidden">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Proposer */}
                  <div className="p-4 border-b md:border-b-0 md:border-r border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="text-purple-400" size={20} />
                      <span className="font-semibold text-purple-300">Proposer (Round {round.round})</span>
                    </div>
                    <div className="text-gray-300 text-sm">
                      <ReactMarkdown>{round.proposerResponse.slice(0, 500)}{round.proposerResponse.length > 500 ? '...' : ''}</ReactMarkdown>
                    </div>
                  </div>
                  
                  {/* Skeptic */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="text-red-400" size={20} />
                      <span className="font-semibold text-red-300">Skeptic (Round {round.round})</span>
                    </div>
                    <div className="text-gray-300 text-sm">
                      <ReactMarkdown>{round.skepticResponse.slice(0, 500)}{round.skepticResponse.length > 500 ? '...' : ''}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Final Answer */}
      {state === 'complete' && finalAnswer && (
        <section className="max-w-4xl mx-auto px-6 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="text-green-400" />
            Final Answer
          </h2>
          
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{finalAnswer}</ReactMarkdown>
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm mr-2">Rate this answer:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => submitRating(score)}
                    disabled={rating !== null}
                    className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium transition-colors ${
                      rating === score 
                        ? 'bg-yellow-500 text-black' 
                        : rating !== null 
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-800 hover:bg-yellow-600 text-white'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
