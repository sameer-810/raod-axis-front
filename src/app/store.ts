import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/modules/auth/authSlice";

/**
 * Redux holds authentication and nothing else.
 *
 * Everything that comes from the server is server state and belongs to TanStack
 * Query, which already solves caching, invalidation and refetching. Copying it
 * into Redux buys a second source of truth and the bugs where they disagree.
 */
export const store = configureStore({
  reducer: { auth: authReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
