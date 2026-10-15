import "./styles.css";

import { NOT_FOUND_SSG_ROUTE, PUBLIC_SSG_ROUTES } from "@hvbc/contracts/routes";
import { ViteSSG } from "vite-ssg";

import App from "./App.vue";
import { routes } from "./router";

export const createApp = ViteSSG(App, { routes });

export const includedRoutes = (): readonly string[] => [
  ...PUBLIC_SSG_ROUTES,
  NOT_FOUND_SSG_ROUTE
];
