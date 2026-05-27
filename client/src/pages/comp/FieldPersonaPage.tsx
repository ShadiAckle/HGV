import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CompCopilot } from '@/components/comp/CompCopilot';
import {
  copilotPromptsForPersona,
  type FieldPersonaQuestionInventory,
} from '@/data/personaQuestionInventory';

interface FieldPersonaPageProps {
  persona: FieldPersonaQuestionInventory;
}

export function FieldPersonaPage({ persona }: FieldPersonaPageProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set([persona.categories[0]?.category ?? ''])
  );
  const [copilotInput, setCopilotInput] = useState('');

  function toggleCategory(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  const dataContext = useMemo(
    () =>
      [
        `## Persona: ${persona.code} — ${persona.title}`,
        `Role in comp funnel: ${persona.funnelRole}`,
        persona.systemsNote ? `Systems referenced: ${persona.systemsNote}` : '',
        '',
        '## Question catalog by category',
        persona.categories
          .map((cat) => `### ${cat.category}\n${cat.questions.map((q) => `- "${q}"`).join('\n')}`)
          .join('\n\n'),
        '',
        persona.dataNote,
      ]
        .filter(Boolean)
        .join('\n'),
    [persona]
  );

  const examplePrompts = copilotPromptsForPersona(persona.id, 6);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Question accordion */}
        <div className="glass-card" style={{ padding: '2.25rem 2rem' }}>
          <div className="space-y-2.5 pb-4">
            <h4 className="text-base font-extrabold text-foreground">Common comp questions by category</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
              Click any question to send it directly to the AI agent. Each question maps to governed datasets in the semantic layer.
            </p>
          </div>
          <div className="space-y-3">
            {persona.categories.map((cat) => {
              const isOpen = openCategories.has(cat.category);
              return (
                <div
                  key={cat.category}
                  className="rounded-xl border border-glass-border bg-card/10 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.category)}
                    className="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/40"
                    style={{ padding: '1.25rem 1.5rem' }}
                    aria-expanded={isOpen}
                    id={`cat-${cat.category.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                      {cat.category}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-glass-border bg-card/25 space-y-2.5" style={{ padding: '1.25rem 1.5rem' }}>
                      {cat.questions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setCopilotInput(q)}
                          className="block w-full rounded-xl border border-glass-border bg-card/45 text-left text-xs text-foreground/90 leading-relaxed transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                          style={{ padding: '0.875rem 1.125rem' }}
                        >
                          &ldquo;{q}&rdquo;
                          <span className="ml-2 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                            → Ask agent
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Copilot */}
        <CompCopilot
          title={`${persona.code} Compensation Agent`}
          description={`Answers grounded in comp policy and governed data for the ${persona.title} role.`}
          personaLabel={persona.title}
          dataContext={dataContext}
          examplePrompts={examplePrompts}
          storageKey={persona.id}
          insightPrompt={`For ${persona.code} (${persona.title}), summarize the top 3 most common comp questions and which system or governed dataset holds each answer. Be specific about system names.`}
          initialInput={copilotInput}
        />
      </div>
    </div>
  );
}

