'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Clock, Star, Brain, MessageSquare, Sparkles, Copy, Check } from 'lucide-react';

interface Round {
  round: number;
  proposerResponse: string;
  skepticResponse: string;
  proposerDurationMs: number;
  skepticDurationMs: number;
}

interface Trace {
  id: string;
  createdAt: string;
  query: string;
  finalAnswer: string;
  totalRounds: number;
  earlyStopped: boolean;
  qualityScore: number | null;
  userRating: number | null;
  autoScore: number | null;
  templatesUsed: string[];
  rounds: Round[];
  models: {
    proposer: string;
    skeptic: string;
    synthesizer: string;
  };
  timing: {
    totalMs: number;
    ragMs: number;
    roundsMs: number[];
    synthesisMs: number;
  };
}

export default function TraceDetailPage() {
  const params = useParams();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadTrace();
  }, [params.id]);

  const loadTrace = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/traces/${params.id}`);
      if (!response.ok) throw new Error('Trace not found');
      const data = await response.json();
      setTrace(data.trace);
      setRating(data.trace.userRating);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trace');
    }
    setLoading(false);
  };

  const submitRating = async (score: number) => {
    if (!trace) return;
    
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/traces/${trace.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: score }),
      });
      setRating(score);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    }
  };

  const copyToClipboard = async () => {
    if (!trace) return;
    await navigator.clipboard.writeText(trace.finalAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-950 p-8 text-white">Loading...</div>;
  }

  if (error || !trace) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="text-red-400">{error || 'Trace not found'}</div>
        <Link href="/traces" className="text-purple-400 hover:underline mt-4 inline-block">
          ← Back to traces
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <Link href="/traces" className="inline-flex items-center gap-2 text-purple-400 hover:underline mb-6">
        <ArrowLeft size={18} />
        Back to traces
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-4">{trace.query}</h1>
        
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {new Date(trace.createdAt).toLocaleString()}
          </span>
          <span>{trace.totalRounds} rounds</span>
          {trace.earlyStopped && <span className="text-yellow-500">Early stopped</span>}
          <span>Proposer: {trace.models.proposer}</span>
          <span>Skeptic: {trace.models.skeptic}</span>
        </div>

        {/* Timing breakdown */}
        <div className="mt-4 flex gap-4 text-sm">
          <span className="text-gray-500">Total: {formatDuration(trace.timing.totalMs)}</span>
          <span className="text-gray-500">RAG: {formatDuration(trace.timing.ragMs)}</span>
          <span className="text-gray-500">Synthesis: {formatDuration(trace.timing.synthesisMs)}</span>
        </div>

        {/* Templates */}
        {trace.templatesUsed.length > 0 && (
          <div className="mt-4">
            <span className="text-gray-500 text-sm">Templates: </span>
            {trace.templatesUsed.map((t, i) => (
              <span key={i} className="inline-block bg-purple-900 text-purple-300 px-2 py-1 rounded text-sm mr-2">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Scores */}
        <div className="mt-4 flex items-center gap-4">
          {trace.autoScore !== null && (
            <div className={`text-2xl font-bold ${getScoreColor(trace.autoScore)}`}>
              Auto-score: {trace.autoScore}/10
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Your rating:</span>
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

      {/* Debate Rounds */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <MessageSquare className="text-purple-400" />
          Debate Transcript
        </h2>

        {trace.rounds.map((round) => (
          <div key={round.round} className="bg-gray-900 rounded-xl overflow-hidden mb-4">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Proposer */}
              <div className="p-4 border-b md:border-b-0 md:border-r border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="text-purple-400" size={20} />
                    <span className="font-semibold text-purple-300">Proposer (Round {round.round})</span>
                  </div>
                  <span className="text-gray-500 text-sm">{formatDuration(round.proposerDurationMs)}</span>
                </div>
                <div className="prose prose-invert max-w-none text-sm text-gray-300">
                  <ReactMarkdown>{round.proposerResponse}</ReactMarkdown>
                </div>
              </div>
              
              {/* Skeptic */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="text-red-400" size={20} />
                    <span className="font-semibold text-red-300">Skeptic (Round {round.round})</span>
                  </div>
                  <span className="text-gray-500 text-sm">{formatDuration(round.skepticDurationMs)}</span>
                </div>
                <div className="prose prose-invert max-w-none text-sm text-gray-300">
                  <ReactMarkdown>{round.skepticResponse}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final Answer */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Sparkles className="text-green-400" />
          Final Answer
        </h2>
        
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown>{trace.finalAnswer}</ReactMarkdown>
          </div>
          
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mt-4"
          >
            {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
