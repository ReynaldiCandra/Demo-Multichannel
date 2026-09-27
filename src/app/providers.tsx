'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so it is never shared
  // between requests on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Sempat dimatikan; diaktifkan lagi supaya data tersinkron begitu
            // tab dibuka lagi setelah dibiarkan lama (akar masalah "tanggal nyangkut").
            refetchOnWindowFocus: true,
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
