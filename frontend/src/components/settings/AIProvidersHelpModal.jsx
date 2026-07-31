import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { HelpCircle, X, ExternalLink, KeyRound, Zap, Server, Boxes, Cpu } from 'lucide-react';

const DIRECT_PROVIDERS = [
  { name: 'Anthropic (Claude)', url: 'https://console.anthropic.com/settings/keys' },
  { name: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys' },
  { name: 'Google AI (Gemini)', url: 'https://aistudio.google.com/app/apikey' },
  { name: 'Groq', url: 'https://console.groq.com/keys' },
  { name: 'xAI (Grok)', url: 'https://console.x.ai' },
  { name: 'Mistral', url: 'https://console.mistral.ai/api-keys' },
  { name: 'Together AI', url: 'https://api.together.ai/settings/api-keys' },
  { name: 'Cerebras', url: 'https://cloud.cerebras.ai' },
  { name: 'Fireworks AI', url: 'https://fireworks.ai/account/api-keys' },
];

function LinkOut({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-neon-cyan hover:underline"
    >
      {children}
      <ExternalLink size={12} className="opacity-70" />
    </a>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-white font-semibold">
        <Icon size={16} className="text-neon-cyan" />
        {title}
      </h3>
      <div className="text-white/80 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function AIProvidersHelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="rounded-2xl p-6 w-full max-w-2xl neon-border-cyan max-h-[90vh] overflow-y-auto bg-gradient-to-b from-[#13131e] to-[#0b0b12] backdrop-blur-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neon-cyan/20 rounded-lg">
              <HelpCircle size={24} className="text-neon-cyan" />
            </div>
            <h2 className="text-2xl font-bold neon-text-cyan">How AI providers work</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <Section icon={KeyRound} title="Bring your own key">
            <p>
              Milo doesn't host AI models or run its own server-side AI. Instead you connect any
              provider you already have an account with. This keeps you in control of cost, privacy,
              and which models you use.
            </p>
            <p>
              Your API key is stored only in this browser's <code className="text-white/80">localStorage</code> and
              is sent directly from your browser to the provider — it never passes through a
              Milo-controlled server.
            </p>
          </Section>

          <Section icon={Zap} title="Easiest way to start: OpenRouter">
            <p>
              <LinkOut href="https://openrouter.ai/keys">OpenRouter</LinkOut> is an aggregator: one
              account, one key, access to 100+ models (Claude, GPT, Gemini, Llama, GLM, and more).
              If you're new, start here — it's the fastest path to a working setup.
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Sign up at <LinkOut href="https://openrouter.ai">openrouter.ai</LinkOut> and add credit.</li>
              <li>Create a key at <LinkOut href="https://openrouter.ai/keys">openrouter.ai/keys</LinkOut>.</li>
              <li>Paste it here, pick "OpenRouter" as the provider, then load models.</li>
            </ol>
          </Section>

          <Section icon={Boxes} title="Direct providers">
            <p>
              Prefer to go straight to the source? Each provider below issues its own keys and bills
              you directly:
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {DIRECT_PROVIDERS.map((p) => (
                <li key={p.name}>
                  <LinkOut href={p.url}>{p.name}</LinkOut>
                </li>
              ))}
              <li>
                <span className="text-white/60">z.ai &amp; z.ai Coding Plan</span>{' '}
                <span className="text-white/40 text-xs">(keys from your z.ai dashboard)</span>
              </li>
            </ul>
          </Section>

          <Section icon={Server} title="Run it yourself (no key, no bill)">
            <p>
              <strong className="text-white/80">Ollama</strong> — run models on your own machine.
              Install from <LinkOut href="https://ollama.com">ollama.com</LinkOut>, then point the
              Ollama URL at it (defaults to <code className="text-white/80">http://localhost:11434</code>).
              Inference stays entirely local.
            </p>
            <p>
              <strong className="text-white/80">Custom</strong> — any OpenAI-compatible endpoint:
              your z.ai Coding Plan endpoint, <LinkOut href="https://lmstudio.ai">LM Studio</LinkOut>,
              vLLM, or a private proxy. Enter its Base URL and an API key if it requires one.
            </p>
          </Section>

          <Section icon={Cpu} title="Picking a model">
            <p>
              After choosing a provider and entering a key/URL, use{' '}
              <span className="text-white/80">Load models</span> to fetch the list of models your key
              can access and pick one from the dropdown. You can also type a model name manually.
            </p>
            <p className="text-white/60 text-xs">
              Tip: every provider exposes different model names. If a model returns an error, try
              loading models again to see exactly what's available to your key.
            </p>
          </Section>
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-semibold hover:bg-neon-cyan/30 transition-all"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
