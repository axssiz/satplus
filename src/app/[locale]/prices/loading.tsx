import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Container className="space-y-6 pt-6 sm:pt-10" >
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-12 w-full" />
      <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-28 rounded-full" />)}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-64" />)}
      </div>
    </Container>
  );
}
