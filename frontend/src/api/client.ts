import { QueryClient } from "@tanstack/react-query";

// Shared QueryClient singleton so non-component flows (src/app/flows.ts)
// can invalidate/refetch the same caches the components read.
export const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
