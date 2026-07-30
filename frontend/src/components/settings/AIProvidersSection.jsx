import { useEffect, useState } from 'react';
import { Save, Eye, EyeOff, RefreshCw, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { loadAISettings, saveAISettings, PROVIDER_GROUPS } from '../../utils/aiSettings';
import { listModels } from '../../ai';
import AIProvidersHelpModal from './AIProvidersHelpModal';

const PROVIDER_LABELS = {
  openrouter: 'OpenRouter (100+ models, one key)',
  anthropic: 'Anthropic (Claude direct)',
  zai: 'z.ai (GLM-4.6, GLM-4.5)',
  zaiCoding: 'z.ai Coding Plan (GLM-4.6)',
  deepseek: 'DeepSeek (Chat, Reasoner)',
  groq: 'Groq (fast Llama / Mixtral)',
  xai: 'xAI (Grok)',
  mistral: 'Mistral (Large, Codestral)',
  together: 'Together AI',
  cerebras: 'Cerebras (fast Llama)',
  fireworks: 'Fireworks AI',
  googleai: 'Google AI (Gemini)',
  custom: 'Custom (OpenAI-compatible URL)',
  ollama: 'Ollama (local / self-hosted)',
};

const PROVIDER_KEY_LABEL = {
  openrouter: 'OpenRouter API key',
  anthropic: 'Anthropic API key',
  zai: 'z.ai API key',
  zaiCoding: 'z.ai Coding Plan API key',
  deepseek: 'DeepSeek API key',
  groq: 'Groq API key',
  xai: 'xAI API key',
  mistral: 'Mistral API key',
  together: 'Together API key',
  cerebras: 'Cerebras API key',
  fireworks: 'Fireworks API key',
  googleai: 'Google AI Studio API key',
  custom: 'API key',
};

const MODEL_PLACEHOLDERS = {
  openrouter: 'anthropic/claude-3.5-sonnet',
  anthropic: 'claude-sonnet-4-6',
  zai: 'glm-4.6',
  zaiCoding: 'glm-4.6',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-4',
  mistral: 'mistral-large-latest',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  cerebras: 'llama-3.3-70b',
  fireworks: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  googleai: 'gemini-2.5-pro',
  custom: 'glm-4.6',
  ollama: 'qwen2.5:7b',
};

export default function AIProvidersSection() {
  const [settings, setSettings] = useState(loadAISettings());
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [modelsError, setModelsError] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const updateProvider = (provider) => setSettings((s) => ({ ...s, provider, model: '' }));
  const updateKey = (val) => setSettings((s) => ({ ...s, keys: { ...s.keys, [s.provider]: val } }));

  const refreshModels = async () => {
    setModelsLoading(true); setModelsError(null);
    try {
      const list = await listModels(settings);
      setModels(list);
      if (!settings.model && list.length) setSettings((s) => ({ ...s, model: list[0] }));
    } catch (e) {
      setModelsError(e.message);
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = () => {
    saveAISettings(settings);
    setSaved(true);
  };

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(t);
  }, [saved]);

  const currentKey = settings.provider === 'ollama' ? '' : settings.keys?.[settings.provider] || '';
  const keyLabel = PROVIDER_KEY_LABEL[settings.provider];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <p className="text-white/60 text-sm">
          Bring your own key. Keys are stored only in your browser's localStorage and sent directly to the provider.
        </p>
        <button
          onClick={() => setIsHelpOpen(true)}
          className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-neon-cyan hover:bg-white/5 transition-colors"
          title="How AI providers work"
          aria-label="How AI providers work"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      <div>
        <label className="block text-white/70 text-sm mb-1">Provider</label>
        <select
          value={settings.provider}
          onChange={(e) => updateProvider(e.target.value)}
          className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
        >
          {PROVIDER_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.providers.map((p) => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {settings.provider === 'custom' && (
        <>
          <div>
            <label className="block text-white/70 text-sm mb-1">Base URL</label>
            <input
              type="text" value={settings.customBaseUrl || ''}
              onChange={(e) => setSettings((s) => ({ ...s, customBaseUrl: e.target.value }))}
              placeholder="https://api.z.ai/api/coding/paas/v4"
              className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none font-mono text-sm"
            />
            <p className="text-white/40 text-xs mt-1">Any OpenAI-compatible endpoint (z.ai coding plan, LM Studio, vLLM, private proxy).</p>
          </div>
          <div>
            <label className="block text-white/70 text-sm mb-1">Display name (optional)</label>
            <input
              type="text" value={settings.customLabel || ''}
              onChange={(e) => setSettings((s) => ({ ...s, customLabel: e.target.value }))}
              placeholder="z.ai Coding Plan"
              className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none text-sm"
            />
          </div>
        </>
      )}

      {settings.provider === 'ollama' ? (
        <div>
          <label className="block text-white/70 text-sm mb-1">Ollama URL</label>
          <input
            type="text" value={settings.ollamaUrl}
            onChange={(e) => setSettings((s) => ({ ...s, ollamaUrl: e.target.value }))}
            placeholder="http://localhost:11434"
            className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
          />
          <p className="text-white/40 text-xs mt-1">Point at your own Ollama instance. Inference stays on your machine.</p>
        </div>
      ) : (
        <div>
          <label className="block text-white/70 text-sm mb-1">{keyLabel}</label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'} value={currentKey}
              onChange={(e) => updateKey(e.target.value)} placeholder="sk-…"
              className="flex-1 bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none font-mono text-sm"
            />
            <button onClick={() => setShowKey((v) => !v)} className="px-3 rounded-lg bg-black/30 border border-white/10 text-white/60 hover:text-white">
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-white/70 text-sm">Model</label>
          <button
            onClick={refreshModels} disabled={modelsLoading}
            className="flex items-center gap-1 text-white/50 hover:text-white text-xs disabled:opacity-50"
          >
            <RefreshCw size={12} className={modelsLoading ? 'animate-spin' : ''} /> Load models
          </button>
        </div>
        {models.length > 0 ? (
          <select
            value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none"
          >
            <option value="">— pick a model —</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input
            type="text" value={settings.model}
            onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            placeholder={MODEL_PLACEHOLDERS[settings.provider] || ''}
            className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none font-mono text-sm"
          />
        )}
        {modelsError && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-red-500/10 rounded border border-red-500/20">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <span className="text-red-400 text-xs font-mono">{modelsError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-white hover:bg-cyan-500/30"
        >
          <Save size={16} /> Save
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-green-400 text-sm">
            <Check size={14} /> Saved
          </span>
        )}
      </div>

      <AIProvidersHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
