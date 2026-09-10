import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * No automatic retry. A failed search should say so immediately rather
       * than spend nine seconds retrying a roadside connection that is not
       * coming back — and the user's own "try again" is better, because they
       * can move first.
       */
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
    mutations: { retry: false },
  },
});
