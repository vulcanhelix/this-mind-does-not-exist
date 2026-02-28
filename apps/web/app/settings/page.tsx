'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Loader2 } from 'lucide-react';

interface Model {
  name: string;
  size: number;
  modifiedAt: string;
}

export default function SettingsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Config state
  const [config, setConfig] = useState({
    proposerModel: 'qwen3:32b',
    skepticModel: 'llama3.3:70b',
    synthesizerModel: 'qwen3:32b',
    maxRounds: 4,
    proposerTemperature: 0.7,
    skepticTemperature: 0.8,
    synthesizerTemperature: 0.5,
    ragTopK: 3,
    finetuneEnabled: false,
  });

  useEffect(() => {
    loadModels();
    loadConfig();
  }, []);

  const loadModels = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/models`);
      const data = await response.json();
      setModels(data.models || []);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
    setLoading(false);
  };

  const loadConfig = () => {
    // Load from localStorage or environment
    const savedConfig = localStorage.getItem('tmde-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      localStorage.setItem('tmde-config', JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
    setSaving(false);
  };

  const triggerFineTune = async () => {
    setSaving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/finetune`, {
        method: 'POST',
      });
      alert('Fine-tuning started! This may take a while.');
    } catch (err) {
      console.error('Failed to start fine-tuning:', err);
      alert('Failed to start fine-tuning');
    }
    setSaving(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="max-w-4xl space-y-8">
          
          {/* Model Selection */}
          <section className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Model Selection</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Proposer Model</label>
                <select
                  value={config.proposerModel}
                  onChange={(e) => setConfig({ ...config, proposerModel: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({formatSize(model.size)})
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Builds and defends answers</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Skeptic Model</label>
                <select
                  value={config.skepticModel}
                  onChange={(e) => setConfig({ ...config, skepticModel: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({formatSize(model.size)})
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Critiques and challenges answers</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Synthesizer Model</label>
                <select
                  value={config.synthesizerModel}
                  onChange={(e) => setConfig({ ...config, synthesizerModel: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({formatSize(model.size)})
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">Produces final polished answer</p>
              </div>
            </div>
          </section>

          {/* Debate Configuration */}
          <section className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Debate Configuration</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Max Rounds: {config.maxRounds}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.maxRounds}
                  onChange={(e) => setConfig({ ...config, maxRounds: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">RAG Top-K: {config.ragTopK}</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.ragTopK}
                  onChange={(e) => setConfig({ ...config, ragTopK: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Proposer Temperature: {config.proposerTemperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.proposerTemperature}
                  onChange={(e) => setConfig({ ...config, proposerTemperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Focused (0)</span>
                  <span>Creative (1)</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Skeptic Temperature: {config.skepticTemperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.skepticTemperature}
                  onChange={(e) => setConfig({ ...config, skepticTemperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Focused (0)</span>
                  <span>Creative (1)</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">Synthesizer Temperature: {config.synthesizerTemperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.synthesizerTemperature}
                  onChange={(e) => setConfig({ ...config, synthesizerTemperature: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Focused (0)</span>
                  <span>Creative (1)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Fine-tuning */}
          <section className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Self-Improvement (Fine-tuning)</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white">Auto Fine-tuning</div>
                  <div className="text-gray-500 text-sm">Automatically improve the Proposer model over time</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.finetuneEnabled}
                    onChange={(e) => setConfig({ ...config, finetuneEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <button
                onClick={triggerFineTune}
                disabled={saving}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Fine-Tune Now
              </button>
              
              <p className="text-gray-500 text-xs">
                Requires at least 50 high-quality debates (8+/10). Fine-tuning will improve the Proposer's reasoning for your specific domain.
              </p>
            </div>
          </section>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-8 py-3 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
