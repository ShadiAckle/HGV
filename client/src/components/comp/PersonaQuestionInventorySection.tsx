import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { Link } from 'react-router';
import { ArrowRight, MessageCircleQuestion } from 'lucide-react';
import { FIELD_PERSONA_QUESTIONS } from '@/data/personaQuestionInventory';

export function PersonaQuestionInventorySection() {
  return (
    <section aria-labelledby="persona-questions-heading" className="scroll-mt-8">
      <Card className="border-border/80 bg-card/50 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex items-center gap-2 text-primary">
            <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Biz Ops question inventory
            </span>
          </div>
          <CardTitle id="persona-questions-heading" className="text-lg leading-snug">
            Likely questions by field persona (C1–C3)
          </CardTitle>
          <CardDescription className="max-w-3xl text-xs leading-relaxed">
            Common field questions mapped to comp topics and governed datasets. C3 has live KPI dashboards; C1 and C2
            question catalogs connect to package, tour, and credit lineage in the semantic layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-3">
          {FIELD_PERSONA_QUESTIONS.map((persona) => (
            <Card key={persona.code} className="flex flex-col border-border/70 bg-background/80 shadow-none">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">{persona.code}. {persona.title}</CardTitle>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {persona.categories.length} categories
                  </span>
                </div>
                <CardDescription className="text-[11px] leading-relaxed">{persona.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 pb-4 pt-0">
                <p className="text-[10px] leading-relaxed text-muted-foreground">{persona.funnelRole}</p>
                {persona.systemsNote && (
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">Systems:</span> {persona.systemsNote}
                  </p>
                )}
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2.5">
                  {persona.categories.map((cat) => (
                    <div key={cat.category}>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {cat.category}
                      </p>
                      <ul className="mt-0.5 space-y-1">
                        {cat.questions.map((q) => (
                          <li key={q} className="text-[11px] leading-snug text-foreground/90">
                            &ldquo;{q}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
                  {persona.dataNote}
                </p>
                <Link
                  to={persona.route}
                  className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  {persona.code === 'C3' ? 'Open compensation view' : 'Open persona page'}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
