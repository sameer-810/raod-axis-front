import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * No automatic retry. A failed search should say so immediately rather
       * than spend nine seconds silently retrying on a roadside connection that
       * is not coming back — and the user's own "try again" is a better retry
       * than ours, because they can move first.
       */
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
    mutations: { retry: false },
  },
});
