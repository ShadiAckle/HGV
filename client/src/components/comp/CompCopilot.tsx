import { Skeleton } from '@databricks/appkit-ui/react';
import { AtSign, BookOpen, Bot, Check, Copy, MessageSquare, RefreshCw, SendHorizontal, Sparkles, Trash2, User, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatQueryError } from '@/lib/compFormat';
import { VisualMentionLibrary } from './VisualMentionLibrary';
import { CopilotQuestionsMenu } from './CopilotSuggestedQuestions';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { PLAIN_ENGLISH_LLM_BLOCK } from '@shared/plainLanguage';

interface ChatChoice {
  message?: { content?: string };
}

interface ChatResponse {
  choices?: ChatChoice[];
}

function extractContent(data: unknown): string {
  const resp = data as ChatResponse;
  return resp?.choices?.[0]?.message?.content ?? JSON.stringify(data);
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** Minimal markdown: bold, bullets, line breaks — no extra deps */
export function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '') {
      elements.push(<span key={key++} className="block h-2" />);
      continue;
    }

    // Bullet list
    if (/^[-•*]\s+/.test(line)) {
      elements.push(
        <div key={key++} className="flex gap-1.5">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{inlineFormat(line.replace(/^[-•*]\s+/, ''))}</span>
        </div>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const num = line.match(/^(\d+)\.\s+/)?.[1] ?? '';
      elements.push(
        <div key={key++} className="flex gap-1.5">
          <span className="shrink-0 font-semibold text-primary/80">{num}.</span>
          <span>{inlineFormat(line.replace(/^\d+\.\s+/, ''))}</span>
        </div>
      );
      continue;
    }

    // Heading (## or ###)
    if (/^#{2,3}\s+/.test(line)) {
      elements.push(
        <p key={key++} className="mt-1 font-semibold text-foreground">
          {line.replace(/^#{2,3}\s+/, '')}
        </p>
      );
      continue;
    }

    elements.push(<p key={key++}>{inlineFormat(line)}</p>);
  }

  return <div className="space-y-0.5 leading-relaxed">{elements}</div>;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const SESSION_KEY_PREFIX = 'hgv_copilot_';

export interface CompCopilotProps {
  title?: string;
  description?: string;
  personaLabel: string;
  dataContext: string;
  examplePrompts: readonly string[];
  contextLoading?: boolean;
  contextError?: string | null;
  insightPrompt?: string;
  autoInsight?: boolean;
  storageKey?: string;
  initialInput?: string;
  /** prefill = set input only; submit = send immediately (default submit) */
  initialInputBehavior?: 'prefill' | 'submit';
}

export function CompCopilot({
  title = 'Compensation Agent',
  description = 'Answers grounded in governed warehouse data — not free-form SQL.',
  personaLabel,
  dataContext,
  examplePrompts,
  contextLoading = false,
  contextError = null,
  insightPrompt,
  autoInsight = true,
  storageKey,
  initialInput,
  initialInputBehavior = 'submit',
}: CompCopilotProps) {
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionResults, setMentionResults] = useState<{ key: string; label: string; category: string }[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMentionLibrary, setShowMentionLibrary] = useState(false);
  const [configuredModel, setConfiguredModel] = useState<string | null>(null);
  const [lastServingEndpoint, setLastServingEndpoint] = useState<string | null>(null);
  const { enabled: plainEnglish, label: plainLabel } = usePlainLanguage();

  useEffect(() => {
    void fetch('/api/comp/model-info')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: { display_name?: string; configured_endpoint?: string } | null) => {
        if (!d) return;
        setConfiguredModel(d.display_name ?? d.configured_endpoint?.replace(/^databricks-/, '') ?? null);
      })
      .catch(() => {});
  }, []);

  // Static fallback mentions (used when API is unavailable / empty query)
  const STATIC_MENTIONS = [
    { key: 'rep:REP-JASON', label: '@rep:REP-JASON (Jason Morrison)', category: 'Reps' },
    { key: 'rep:REP-RSMITH', label: '@rep:REP-RSMITH (R. Smith)', category: 'Reps' },
    { key: 'rep:REP-ECARTER', label: '@rep:REP-ECARTER (E. Carter)', category: 'Reps' },
    { key: 'rep:REP-DLEE', label: '@rep:REP-DLEE (D. Lee)', category: 'Reps' },
    { key: 'rep:REP-KNGUYEN', label: '@rep:REP-KNGUYEN (K. Nguyen)', category: 'Reps' },
    { key: 'rep:REP-MGR-01', label: '@rep:REP-MGR-01 (M. Vance - Mgr)', category: 'Reps' },
    { key: 'team:TEAM-WEST', label: '@team:TEAM-WEST (West Coast)', category: 'Teams' },
    { key: 'team:TEAM-EAST', label: '@team:TEAM-EAST (East Coast)', category: 'Teams' },
    { key: 'scenario:SCN-BASELINE', label: '@scenario:SCN-BASELINE (Q1 Baseline)', category: 'Scenarios' },
    { key: 'scenario:SCN-SIM-01', label: '@scenario:SCN-SIM-01 (Q2 Incentive)', category: 'Scenarios' },
    { key: 'scenario:SCN-PLAN-A', label: '@scenario:SCN-PLAN-A (Plan A)', category: 'Scenarios' },
    { key: 'deal:DEAL-1001', label: '@deal:DEAL-1001 (Waikikian 3PH)', category: 'Deals' },
    { key: 'deal:DEAL-1002', label: '@deal:DEAL-1002 (Orlando Deluxe)', category: 'Deals' },
    { key: 'deal:DEAL-1003', label: '@deal:DEAL-1003 (West Coast Club)', category: 'Deals' },
    { key: 'deal:DEAL-1004', label: '@deal:DEAL-1004 (FFS Bundle)', category: 'Deals' },
  ];

  const filteredMentions = mentionResults.length > 0 ? mentionResults : STATIC_MENTIONS.filter(
    (m) =>
      m.label.toLowerCase().includes(mentionQuery) ||
      m.category.toLowerCase().includes(mentionQuery)
  );

  const [messages, setMessages] = useState<Message[]>(() => {
    if (!storageKey) return [];
    try {
      const saved = sessionStorage.getItem(SESSION_KEY_PREFIX + storageKey);
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsAutoTriggered, setInsightsAutoTriggered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastInitialInputRef = useRef<string | null>(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (!storageKey) return;
    sessionStorage.setItem(SESSION_KEY_PREFIX + storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, insights]);

  // Auto-trigger Insights once when data context first loads (no messages yet)
  useEffect(() => {
    if (
      autoInsight &&
      insightPrompt &&
      dataContext &&
      !contextLoading &&
      !contextError &&
      !insightsAutoTriggered &&
      messages.length === 0 &&
      !insights
    ) {
      setInsightsAutoTriggered(true);
      handleInsight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataContext, contextLoading, contextError]);

  // Re-generate auto-insights when Simple View toggles
  useEffect(() => {
    setInsights(null);
    setInsightsAutoTriggered(false);
  }, [plainEnglish]);

  // Handle parent-triggered input (prefill or auto-submit)
  useEffect(() => {
    if (!initialInput || initialInput === lastInitialInputRef.current) return;
    lastInitialInputRef.current = initialInput;

    if (initialInputBehavior === 'prefill') {
      setInput(initialInput);
      inputRef.current?.focus();
      return;
    }

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: initialInput };
    setMessages((prev) => {
      const thread = [...prev, userMessage];
      sendMessage(thread);
      return thread;
    });
  }, [initialInput, initialInputBehavior]);

  const invokeCopilot = useCallback(async (body: { messages: { role: string; content: string }[] }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/comp/copilot/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? `HTTP ${res.status}`);
      }
      const endpoint = res.headers.get('X-Serving-Endpoint');
      if (endpoint) setLastServingEndpoint(endpoint);
      return (await res.json()) as ChatResponse;
    } catch (err) {
      if (controller.signal.aborted) return null;
      const message = err instanceof Error ? err.message : 'Request failed';
      setError(message);
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos >= 0 && lastAtPos >= val.lastIndexOf(' ')) {
      const query = val.slice(lastAtPos + 1).toLowerCase();
      setShowMentions(true);
      setMentionQuery(query);
      setMentionIndex(0);

      // Debounced live search from the database
      if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
      mentionDebounceRef.current = setTimeout(async () => {
        setMentionLoading(true);
        try {
          const res = await fetch(`/api/comp/copilot/mentions-search?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json() as { key: string; label: string; category: string }[];
            setMentionResults(data);
          } else {
            setMentionResults([]);
          }
        } catch {
          setMentionResults([]);
        } finally {
          setMentionLoading(false);
        }
      }, 250);
    } else {
      setShowMentions(false);
      setMentionResults([]);
    }
  };

  const handleSelectMention = (key: string) => {
    const inputEl = inputRef.current;
    if (!inputEl) return;

    const start = inputEl.selectionStart ?? input.length;
    const end = inputEl.selectionEnd ?? input.length;
    
    const textBeforeCursor = input.slice(0, start);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    
    let nextInput = '';
    let newCursorPos = 0;

    // Check if we are completing a typed @ trigger
    if (lastAtPos >= 0 && !textBeforeCursor.slice(lastAtPos).includes(' ')) {
      nextInput = input.slice(0, lastAtPos) + `@${key} ` + input.slice(end);
      newCursorPos = lastAtPos + `@${key} `.length;
    } else {
      const prefix = textBeforeCursor.endsWith(' ') || textBeforeCursor === '' ? '' : ' ';
      nextInput = input.slice(0, start) + prefix + `@${key} ` + input.slice(end);
      newCursorPos = start + prefix.length + `@${key} `.length;
    }

    setInput(nextInput);
    setShowMentions(false);

    // Reposition cursor and refocus
    setTimeout(() => {
      inputEl.focus();
      inputEl.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    // Apply transient glowing ring to indicate active tag addition
    inputEl.classList.add('ring-2', 'ring-primary', 'scale-[1.01]');
    setTimeout(() => {
      inputEl.classList.remove('ring-2', 'ring-primary', 'scale-[1.01]');
    }, 800);
  };

  const parseMentions = (text: string): string[] => {
    const matches = text.match(/@(rep:[A-Za-z0-9_-]+|team:[A-Za-z0-9_-]+|scenario:[A-Za-z0-9_-]+|deal:[A-Za-z0-9_-]+)/g) ?? [];
    return matches.map((m) => m.slice(1));
  };

  function buildPrompt(thread: Message[], supplementaryContext = ''): string {
    const systemCtx = [
      `You are the HGV IGNITE Compensation Agent — an expert compensation analyst embedded in the HGV Sales Compensation Control Center.`,
      `You are answering a question from: ${personaLabel}.`,
      '',
      'CRITICAL RULES — FOLLOW EXACTLY:',
      '1. ANSWER DIRECTLY WITH FACTS. You have full transaction data below. Give the actual answer immediately.',
      '2. NEVER say "check Voice system", "log into Salesforce", "contact your manager", or any variation. That is NOT an answer — it is a cop-out. The data is already here.',
      '3. When asked about a specific package ID, tour ID, booking ID, contract ID, or guest name — look it up in the context tables and state the exact status, amount, date, and reason.',
      '4. State exact dollar amounts, percentages, dates, and IDs from the context. Do not round or generalize.',
      '5. If a record truly does not exist in the context, say: "Record [ID] was not found in the current dataset. In production, this would be pulled from [system name]."',
      '6. Keep answers concise: 2–5 bullet points. Lead with the direct answer, follow with supporting detail.',
      '7. When policy explains a behavior (e.g. a clawback, NQ rating), cite the specific rule and how it applies.',
      '8. For scenario comparisons, state the exact delta between scenarios in dollar amounts and percentage points.',
      '9. If the user mentions any specific entity using "@rep:...", "@team:...", "@scenario:...", or "@deal:...", look them up in the MENTION LOOKUP section below and give precise answers based on that data.',
      plainEnglish ? '' : '',
      plainEnglish ? PLAIN_ENGLISH_LLM_BLOCK : '',
      '',
      '=== LIVE TRANSACTION & POLICY DATA CONTEXT ===',
      dataContext,
      '',
      supplementaryContext ? '=== SUPPLEMENTARY MENTION LOOKUP DATA ===' : '',
      supplementaryContext,
      '=== END OF CONTEXT ===',
    ].filter(Boolean).join('\n');

    const last = thread[thread.length - 1];
    if (thread.length === 1) {
      return `${systemCtx}\n\nQuestion to answer:\n${last.content}`;
    }

    const prior = thread.slice(0, -1);
    const transcript = prior.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    return `${systemCtx}\n\n--- Prior conversation ---\n${transcript}\n--- New question ---\n${last.content}`;
  }

  function sendMessage(thread: Message[]) {
    setLoading(true);
    setError(null);

    const lastMessage = thread[thread.length - 1];
    const detectedMentions = parseMentions(lastMessage.content);

    let fetchPromise = Promise.resolve('');
    if (detectedMentions.length > 0) {
      fetchPromise = fetch('/api/comp/copilot/mentions-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentions: detectedMentions }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<Record<string, string>>;
        })
        .then((dict) => {
          return Object.entries(dict)
            .map(([mention, details]) => `\n### [MENTION LOOKUP] @${mention}\n${details}`)
            .join('\n');
        })
        .catch((err) => {
          console.error('Mention lookup failed', err);
          return `\n(Warning: Mentions lookup failed - ${err instanceof Error ? err.message : String(err)})`;
        });
    }

    fetchPromise.then((supplementaryContext) => {
      const prompt = buildPrompt(thread, supplementaryContext);
      void invokeCopilot({ messages: [{ role: 'user', content: prompt }] }).then((result) => {
        if (result) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: extractContent(result) },
          ]);
        }
        setLoading(false);
      });
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || contextLoading || !dataContext) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const thread = [...messages, userMessage];
    setMessages(thread);
    setInput('');
    setShowMentions(false);
    sendMessage(thread);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentions[mentionIndex].key);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  function handlePromptClick(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  function handleInsight() {
    if (!insightPrompt || loading || contextLoading || !dataContext) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: insightPrompt };
    setInsights('loading');
    void invokeCopilot({ messages: [{ role: 'user', content: buildPrompt([userMessage]) }] }).then((result) => {
      setInsights(result ? extractContent(result) : null);
    });
  }

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setInsights(null);
    setError(null);
    setLoading(false);
    if (storageKey) sessionStorage.removeItem(SESSION_KEY_PREFIX + storageKey);
  }

  async function handleCopy(id: string, content: string) {
    await navigator.clipboard.writeText(content).catch(() => null);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const disabled = loading || contextLoading || !!contextError || !dataContext;

  return (
    <div className={`grid gap-4 transition-all duration-300 ${showMentionLibrary ? 'lg:grid-cols-[1fr_330px]' : 'grid-cols-1'}`}>
      <div className="flex flex-col rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-xl shadow-xl overflow-hidden">
      {/* Copilot Header */}
      <div className="relative border-b border-glass-border bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
              <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{plainLabel(title)}</span>
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {examplePrompts.length > 0 && (
                <CopilotQuestionsMenu
                  prompts={examplePrompts}
                  disabled={disabled}
                  onSelect={handlePromptClick}
                />
              )}
              <button
                type="button"
                onClick={() => setShowMentionLibrary(!showMentionLibrary)}
                title="Discover Mentions Library"
                className={`inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  showMentionLibrary
                    ? 'bg-gradient-to-r from-hgv-gold to-hgv-gold-light text-black border-transparent shadow-md'
                    : 'bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
                }`}
              >
                <BookOpen className="h-3 w-3" aria-hidden />
                <span className="hidden sm:inline">Mentions</span>
              </button>
              {insightPrompt && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleInsight}
                  title="Generate AI insights from live data"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.3rem 0.75rem',
                    borderRadius: 8,
                    border: 'none',
                    background: disabled
                      ? 'var(--bg-overlay)'
                      : 'linear-gradient(135deg, var(--gold) 0%, #e8b84b 100%)',
                    color: disabled ? 'var(--foreground-muted)' : '#1a1000',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    boxShadow: disabled ? 'none' : '0 2px 10px rgba(201,162,39,0.4)',
                    animation: disabled ? 'none' : 'pulse-glow-gold 2.5s ease-in-out infinite',
                    letterSpacing: '0.01em',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Sparkles style={{ width: 11, height: 11, flexShrink: 0 }} aria-hidden />
                  <span className="hidden sm:inline">✦ Insights</span>
                </button>
              )}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  title="Clear conversation"
                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-glass-border bg-muted/20 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>
          {description ? (
            <p className="text-[11px] leading-snug text-muted-foreground font-medium">{plainLabel(description)}</p>
          ) : null}
          <p className="text-[10px] text-muted-foreground/60 truncate">
            {configuredModel ? (
              <>
                Model:{' '}
                <span
                  className={
                    lastServingEndpoint && /llama|meta-llama/i.test(lastServingEndpoint)
                      ? 'font-semibold text-amber-600'
                      : 'text-foreground/70'
                  }
                >
                  {(lastServingEndpoint ?? configuredModel).replace(/^databricks-/, '')}
                </span>
                {lastServingEndpoint && /llama|meta-llama/i.test(lastServingEndpoint)
                  ? ' — fallback (not Sonnet)'
                  : ''}
              </>
            ) : (
              'Powered by Databricks Model Serving'
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-5">
        {contextError && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>{formatQueryError(contextError)}</p>
          </div>
        )}

        {/* AI Insights panel */}
        {insights && insights !== 'loading' && (
          <div className="animate-fade-in-up rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-primary">
              <Sparkles className="h-3 w-3" aria-hidden />
              AI Insights
            </p>
            <div className="text-xs text-foreground/90 leading-relaxed">{renderMarkdown(insights)}</div>
          </div>
        )}
        {insights === 'loading' && <Skeleton className="h-20 w-full rounded-xl" />}

        {/* Chat window */}
        <div
          ref={scrollRef}
          className="chat-scroll min-h-[10rem] max-h-[26rem] flex-1 space-y-3.5 overflow-y-auto rounded-xl border border-glass-border bg-card/20 p-4.5"
        >
          {messages.length === 0 && !contextLoading && !loading && (
            <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/20" aria-hidden />
              <p className="text-xs text-muted-foreground font-medium">
                Ask a compensation question for the <strong className="text-foreground/70">{personaLabel}</strong> view.
              </p>
              <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <AtSign className="h-3 w-3" /> Type @ to mention a rep, team, scenario, or deal
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`animate-fade-in-up flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                    : 'bg-muted border border-glass-border text-foreground'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Bot className="h-3.5 w-3.5" aria-hidden />
                )}
              </div>

              <div className={`group relative max-w-[88%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'rounded-tl-sm border border-glass-border bg-card/60 backdrop-blur-sm text-foreground shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    title="Copy response"
                  >
                    {copiedId === msg.id ? (
                      <><Check className="h-2.5 w-2.5 text-emerald-500" /> Copied</>
                    ) : (
                      <><Copy className="h-2.5 w-2.5" /> Copy</>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-glass-border bg-muted">
                <Bot className="h-3.5 w-3.5" aria-hidden />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-glass-border bg-card/60 px-3 py-2.5 shadow-sm">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              <X className="mt-0.5 h-3 w-3 shrink-0" />
              {formatQueryError(error)}
              <button
                type="button"
                className="ml-auto shrink-0 underline"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Input & Autocomplete Dropdown */}
        <div className="relative">
          {showMentions && (mentionLoading || filteredMentions.length > 0) && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-full max-h-52 overflow-y-auto rounded-xl border border-glass-border bg-card/90 backdrop-blur-xl shadow-xl p-1.5 space-y-0.5 animate-fade-in-up">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-glass-border mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Mention Database Entities
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                  {mentionLoading && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                  <span>@rep · @team · @scenario · @deal</span>
                </div>
              </div>
              {filteredMentions.map((item, idx) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectMention(item.key)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex justify-between items-center gap-2 transition-all ${
                    idx === mentionIndex
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'hover:bg-primary/10 hover:text-primary text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${
                    idx === mentionIndex
                      ? 'bg-white/20 text-white'
                      : item.category === 'Reps' ? 'bg-primary/10 text-primary'
                      : item.category === 'Teams' ? 'bg-emerald-500/10 text-emerald-600'
                      : item.category === 'Scenarios' ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-purple-500/10 text-purple-600'
                  }`}>
                    {item.category}
                  </span>
                </button>
              ))}
              {mentionLoading && filteredMentions.length === 0 && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 animate-spin" /> Searching database…
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
              <input
                ref={inputRef}
                id="copilot-input"
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  contextLoading
                    ? 'Loading data context…'
                    : contextError
                    ? 'Data unavailable'
                    : 'Ask about comp, quota, or type @ to mention…'
                }
                disabled={disabled}
                maxLength={500}
                aria-label="Ask the compensation agent"
                className="w-full rounded-xl border border-glass-border bg-card/40 pl-8 pr-3 py-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-card/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-50 transition-all"
              />
            </div>
            {loading ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                title="Cancel"
                className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-xl border border-glass-border bg-muted/20 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={disabled || !input.trim()}
                title="Send message"
                className="inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.05] active:scale-[0.97]"
              >
                <SendHorizontal className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </form>
        </div>
        {input.length > 400 && (
          <p className="text-right text-[10px] text-muted-foreground">{input.length}/500</p>
        )}
      </div>
    </div>

    {showMentionLibrary && (
      <div className="h-full min-h-[30rem] lg:min-h-0 animate-fade-in-up">
        <VisualMentionLibrary
          onSelectMention={handleSelectMention}
          onClose={() => setShowMentionLibrary(false)}
        />
      </div>
    )}
  </div>
  );
}
