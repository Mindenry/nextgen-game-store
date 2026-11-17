import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="container-page py-10">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="surface-card overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full !rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-4 h-5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
