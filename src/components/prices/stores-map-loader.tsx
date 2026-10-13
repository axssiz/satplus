"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapPoint } from "./stores-map";

const StoresMap = dynamic(() => import("./stores-map"), { ssr: false, loading: () => <Skeleton className="h-72 w-full" /> });

export function StoresMapLoader({ points }: { points: MapPoint[] }) {
  return <StoresMap points={points} />;
}
