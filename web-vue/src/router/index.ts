import type { RouteRecordRaw } from "vue-router";

import { publicRoutes } from "./routes-public";
import { spaRoutes } from "./routes-spa";

export const routes: RouteRecordRaw[] = [...publicRoutes, ...spaRoutes];
