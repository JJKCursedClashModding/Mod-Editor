// Enum member registry for dropdowns.
//
// Two-tier lookup (mirrors the vanilla renderer's ensureEnumMembers):
//   1. Baked snapshot — scripts/export-frontend-enums.js bakes data/enums.ts
//      into enums.generated.ts. Zero IPC, always available after `npm run enums`.
//   2. IPC probe fallback — docs:field with "__probe__" returns d.enum.members
//      from the backend's live parseEnumsTs(). Covers enums missing from a
//      stale snapshot. Cached forever by React Query.
import { useQuery } from "@tanstack/react-query";
import { api } from "./ipc";
import { ENUM_MEMBERS } from "./enums.generated";

export interface EnumMember {
  name: string;
  value: number;
}

export function bakedEnumMembers(enumName: string): EnumMember[] {
  return ENUM_MEMBERS[enumName] || [];
}

export function useEnumMembers(enumName: string | null | undefined): EnumMember[] {
  const baked = (enumName && bakedEnumMembers(enumName)) || [];
  const probe = useQuery({
    queryKey: ["enumMembers", enumName],
    queryFn: async () => {
      const d = await api.docsField("DamageDataTable", "DamageDataTable", "__probe__", enumName!);
      return ((d.enum && d.enum.members) || []) as EnumMember[];
    },
    enabled: !!enumName && baked.length === 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  if (!enumName) return [];
  if (baked.length > 0) return baked;
  return probe.data || [];
}
