import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { ClipboardList } from 'lucide-react';
import { SEMANTIC_LAYER_DISCOVERY } from '@/data/semanticLayerDiscovery';

export function SemanticLayerDiscoverySection() {
  return (
    <section className="scroll-mt-8" aria-labelledby="semantic-discovery-heading">
      <Card className="border-border/80 bg-card/50 shadow-sm backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  Stakeholder discovery
                </span>
              </div>
              <CardTitle id="semantic-discovery-heading" className="text-lg leading-snug">
                Discovery — align before we encode comp logic
              </CardTitle>
              <CardDescription className="max-w-3xl text-xs leading-relaxed">
                Align comp policy and data definitions before encoding logic in the semantic layer. Example questions
                show what the agent can answer once each theme is governed in Unity Catalog.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          {SEMANTIC_LAYER_DISCOVERY.map((cat) => (
            <Card key={cat.id} className="border-border/70 bg-background/80 shadow-none">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-semibold">{cat.title}</CardTitle>
                <CardDescription className="text-[11px] leading-relaxed">{cat.purpose}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0 pb-4">
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Discovery questions
                  </p>
                  <ul className="list-inside list-disc space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {cat.discoveryQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Example questions
                  </p>
                  <ul className="space-y-1.5 text-[11px] leading-relaxed text-foreground/90">
                    {cat.agentExampleQuestions.map((q) => (
                      <li key={q}>&ldquo;{q}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
