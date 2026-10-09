import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Container className="flex flex-1 items-start justify-center py-10 sm:py-16">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
        {children}
      </Card>
    </Container>
  );
}

export function FormSkeleton({ fields }: { fields: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
