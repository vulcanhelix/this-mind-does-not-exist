'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Star, Clock, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
}

export default function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [stats, setStats] = useState({ totalTraces: 0, avgQuality: 0, fineTuneCandidates: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minQuality, setMinQuality] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadTraces();
  }, [page, search, minQuality]);

  const loadTraces = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: String(page * 20),
      });
      if (search) params.append('search', search);
      if (minQuality) params.append('minQuality', minQuality);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/traces?${params}`);
      const data = await response.json();
      
      setTraces(data.traces || []);
      setStats(data.stats || { totalTraces: 0, avgQuality: 0, fineTuneCandidates: 0 });
      setHasMore(data.traces?.length === 20);
    } catch (err) {
      console.error('Failed to load traces:', err);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Debate Traces</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Total Debates</div>
          <div className="text-2xl font-bold text-white">{stats.totalTraces}</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Average Quality</div>
          <div className="text-2xl font-bold text-white">{stats.avgQuality.toFixed(1)}</div>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg">
          <div className="text-gray-400 text-sm">Fine-tune Candidates</div>
          <div className="text-2xl font-bold text-purple-400">{stats.fineTuneCandidates}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Search queries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-gray-500" size={18} />
          <select
            value={minQuality}
            onChange={(e) => setMinQuality(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Quality</option>
            <option value="8">8+ (Excellent)</option>
            <option value="6">6+ (Good)</option>
            <option value="4">4+ (OK)</option>
          </select>
        </div>
      </div>

      {/* Traces List */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading...</div>
      ) : traces.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
          <p>No debates found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {traces.map((trace) => (
            <Link
              key={trace.id}
              href={`/traces/${trace.id}`}
              className="block bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1 line-clamp-2">{trace.query}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatDate(trace.createdAt)}
                    </span>
                    <span>{trace.totalRounds} rounds</span>
                    {trace.earlyStopped && <span className="text-yellow-500">Early stopped</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {trace.autoScore !== null && (
                    <div className={`text-lg font-bold ${getScoreColor(trace.autoScore)}`}>
                      {trace.autoScore}/10
                    </div>
                  )}
                  {trace.userRating !== null && (
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star size={14} fill="currentColor" />
                      <span className="text-sm">{trace.userRating}</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm line-clamp-2">{trace.finalAnswer}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {traces.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white"
          >
            <ChevronLeft size={18} />
            Previous
          </button>
          <span className="text-gray-400">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white"
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
