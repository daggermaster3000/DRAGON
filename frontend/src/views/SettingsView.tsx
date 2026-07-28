import { useEffect, useState } from "react";
import { api, type AiSettings } from "../api";
import { ErrorBox } from "./DashboardView";

const LABELS: Record<string, string> = {
  rules: "Rules only (no AI)",
  ollama: "Ollama (local, private)",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  mistral: "Mistral",
};

export function SettingsView() {
  const [s, setS] = useState<AiSettings | null>(null);
  const [provider, setProvider] = useState("rules");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);
  // editable fields
  const [f, setF] = useState<Record<string, string>>({});

  function load() {
    api.getSettings().then((cfg) => {
      setS(cfg);
      setProvider(cfg.provider);
      setF({
        ollama_base_url: cfg.ollama_base_url, ollama_model: cfg.ollama_model,
        openai_model: cfg.openai_model, anthropic_model: cfg.anthropic_model, mistral_model: cfg.mistral_model,
        openai_api_key: "", anthropic_api_key: "", mistral_api_key: "",
      });
    }).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function set(k: string, v: string) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    setBusy(true); setError(null); setNote(null); setTest(null);
    // Only send API keys the user actually typed (blank = leave unchanged).
    const patch: Record<string, string> = { provider };
    for (const [k, v] of Object.entries(f)) {
      if (k.endsWith("_api_key")) { if (v) patch[k] = v; }
      else patch[k] = v;
    }
    try {
      await api.updateSettings(patch);
      setNote("Saved.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function runTest() {
    setBusy(true); setTest(null); setError(null);
    try { setTest(await api.testProvider()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (error && !s) return <ErrorBox msg={error} />;
  if (!s) return <p className="text-sm text-ink-muted">Loading…</p>;

  const keyPlaceholder = (setFlag: boolean, hint: string) => (setFlag ? `Set (${hint}) — type to replace` : "Paste API key");

  return (
    <div className="space-y-4">
      {error && <ErrorBox msg={error} />}

      <div className="rounded-2xl border border-black/10 bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-ink">AI provider</h2>
        <p className="mb-3 text-xs text-ink-muted">Used for classifying ambiguous transactions and the budget oracle / dragon quips. Keys are stored on your Pi and never shown again.</p>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {s.providers.map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                provider === p ? "border-ink bg-ink/5 text-ink" : "border-black/10 text-ink-soft hover:bg-black/5"
              }`}
            >
              {LABELS[p] ?? p}
            </button>
          ))}
        </div>

        {provider === "ollama" && (
          <div className="space-y-3">
            <Field label="Ollama base URL"><input value={f.ollama_base_url ?? ""} onChange={(e) => set("ollama_base_url", e.target.value)} className={inputCls} /></Field>
            <Field label="Model"><input value={f.ollama_model ?? ""} onChange={(e) => set("ollama_model", e.target.value)} placeholder="llama3.2" className={inputCls} /></Field>
          </div>
        )}
        {provider === "openai" && (
          <div className="space-y-3">
            <Field label="OpenAI API key"><input type="password" value={f.openai_api_key ?? ""} onChange={(e) => set("openai_api_key", e.target.value)} placeholder={keyPlaceholder(s.openai_api_key_set, s.openai_api_key_hint)} className={inputCls} /></Field>
            <Field label="Model"><input value={f.openai_model ?? ""} onChange={(e) => set("openai_model", e.target.value)} placeholder="gpt-4o-mini" className={inputCls} /></Field>
          </div>
        )}
        {provider === "anthropic" && (
          <div className="space-y-3">
            <Field label="Anthropic API key"><input type="password" value={f.anthropic_api_key ?? ""} onChange={(e) => set("anthropic_api_key", e.target.value)} placeholder={keyPlaceholder(s.anthropic_api_key_set, s.anthropic_api_key_hint)} className={inputCls} /></Field>
            <Field label="Model"><input value={f.anthropic_model ?? ""} onChange={(e) => set("anthropic_model", e.target.value)} placeholder="claude-haiku-4-5" className={inputCls} /></Field>
          </div>
        )}
        {provider === "mistral" && (
          <div className="space-y-3">
            <Field label="Mistral API key"><input type="password" value={f.mistral_api_key ?? ""} onChange={(e) => set("mistral_api_key", e.target.value)} placeholder={keyPlaceholder(s.mistral_api_key_set, s.mistral_api_key_hint)} className={inputCls} /></Field>
            <Field label="Model"><input value={f.mistral_model ?? ""} onChange={(e) => set("mistral_model", e.target.value)} placeholder="mistral-small-latest" className={inputCls} /></Field>
          </div>
        )}
        {provider === "rules" && <p className="text-xs text-ink-muted">No AI — deterministic merchant rules + your bank's categories only. Fully private, zero external calls.</p>}

        <div className="mt-4 flex items-center gap-2">
          <button onClick={save} disabled={busy} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85 disabled:opacity-50">Save</button>
          <button onClick={runTest} disabled={busy} className="rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-soft hover:bg-black/5 disabled:opacity-50">Test connection</button>
          {note && <span className="text-xs text-hp-good">{note}</span>}
        </div>
        {test && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${test.ok ? "border-hp-good/30 bg-hp-good/10 text-ink-soft" : "border-hp-danger/30 bg-hp-danger/10 text-hp-danger"}`}>
            {test.ok ? "✓ Connected — " : "✕ "}{test.detail}
          </div>
        )}
      </div>

      <p className="text-xs text-ink-muted">
        Note on MCP: MCP servers are a tool protocol, not a drop-in text model, so they can't back classification directly. If you run an OpenAI-compatible gateway (LocalAI, OpenRouter, an MCP→OpenAI bridge), point the OpenAI provider at it — ask and I'll add a custom base-URL field.
      </p>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-ink/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-ink-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
