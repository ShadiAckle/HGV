import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@databricks/appkit-ui/react';
import { Link } from 'react-router';
import { ArrowRight, Database, Layers, Users } from 'lucide-react';
import { PersonaQuestionInventorySection } from '@/components/comp/PersonaQuestionInventorySection';
import { SemanticLayerDiscoverySection } from '@/components/assistant/SemanticLayerDiscoverySection';
import { DATA_MODEL_CATALOG } from '@/data/dataModelCatalog';
import { COMP_CAPABILITIES, PERSONAS } from '@/data/personas';

export function PocOverviewPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-8 shadow-sm">
        <div className="relative space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">HGV IGNITE · AI Compensation Agent</p>
          <h2 className="text-3xl font-semibold tracking-tight">One system — persona-specific views</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A governed compensation intelligence layer for Hilton Grand Vacations field and corporate teams. One semantic
            model in Unity Catalog powers persona-specific dashboards and an AI copilot—each view enforces the same comp
            rules and data lineage your calc engine produces.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary" className="font-normal">
              <Database className="mr-1 h-3 w-3" aria-hidden />
              workspace.hgv_comp
            </Badge>
            <Badge variant="outline" className="font-normal">
              Production comp semantic layer
            </Badge>
          </div>
        </div>
      </div>

      <section aria-labelledby="pillars-heading">
        <h3 id="pillars-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-4 w-4" aria-hidden />
          Platform capabilities
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {COMP_CAPABILITIES.map((pillar) => (
            <Card key={pillar.id} className="border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {pillar.title}
                  {'optional' in pillar && pillar.optional && (
                    <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                      Extension
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">{pillar.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="personas-heading">
        <h3 id="personas-heading" className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden />
          Persona views
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map((persona) => (
            <Card key={persona.id} className="flex flex-col border-border/80 transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {persona.code && (
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">{persona.code}</span>
                  )}
                  {persona.title}
                </CardTitle>
                <CardDescription className="text-xs">{persona.exampleOwner}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3 text-xs">
                <p className="leading-relaxed text-muted-foreground">{persona.summary}</p>
                {persona.dataNote && (
                  <p className="rounded-md border border-border/60 bg-muted/20 p-2 text-[11px] text-muted-foreground">
                    {persona.dataNote}
                  </p>
                )}
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  {persona.keyQuestions.slice(0, 2).map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <Link
                  to={persona.route}
                  className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open view
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="semantic-heading">
        <h3 id="semantic-heading" className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Semantic layer catalog
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {DATA_MODEL_CATALOG.map((model) => (
            <Card key={model.id} className="border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{model.title}</CardTitle>
                <CardDescription className="font-mono text-[10px]">{model.unityCatalogTable}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{model.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {model.queryKeys.map((k) => (
                    <Badge key={k} variant="outline" className="font-mono text-[10px] font-normal">
                      {k}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="border-border/80 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Data governance</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            All metrics flow from governed Unity Catalog tables in <code className="text-[10px]">workspace.hgv_comp</code>.
            Row-level access follows your existing entitlements; the copilot narrates only what the semantic layer returns—
            never free-form SQL or invented numbers.
          </CardDescription>
        </CardHeader>
      </Card>

      <PersonaQuestionInventorySection />

      <SemanticLayerDiscoverySection />
    </div>
  );
}
