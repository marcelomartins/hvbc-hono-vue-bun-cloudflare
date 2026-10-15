import { PROTECTED_ROUTE_PREFIXES } from "@hvbc/contracts/routes";
import type { RouteRecordRaw } from "vue-router";

const [dashboardPath, accountPath, settingsPath] = PROTECTED_ROUTE_PREFIXES;

export const spaRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    component: () => import("../app/layouts/SpaLayout.vue"),
    children: [
      {
        path: dashboardPath.slice(1),
        name: "dashboard",
        component: () => import("../app/pages/DashboardPage.vue")
      },
      {
        path: accountPath.slice(1),
        name: "account",
        component: () => import("../app/pages/AccountPage.vue")
      },
      {
        path: settingsPath.slice(1),
        name: "settings",
        component: () => import("../app/pages/SettingsPage.vue")
      }
    ]
  }
];
