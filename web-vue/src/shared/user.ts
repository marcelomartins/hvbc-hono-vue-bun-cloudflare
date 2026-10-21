import type { UserDto } from "@hvbc/contracts/api";
import { inject, provide, shallowRef, type InjectionKey, type ShallowRef } from "vue";

interface UserContext {
  user: ShallowRef<UserDto | null>;
  setUser: (user: UserDto) => void;
}

const userKey: InjectionKey<UserContext> = Symbol("hvbc-current-user");

export function provideCurrentUser(): UserContext {
  const user = shallowRef<UserDto | null>(null);
  const context: UserContext = { user, setUser: (updated) => { user.value = updated; } };
  provide(userKey, context);
  return context;
}

export function useCurrentUser(): UserContext {
  const context = inject(userKey);
  if (context === undefined) throw new Error("current user context was not provided");
  return context;
}
