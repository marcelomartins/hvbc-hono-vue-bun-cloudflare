import { PROTECTED_HOME_ROUTE } from "@hvbc/contracts/routes";
import type { RouteRecordRaw } from "vue-router";

export const spaRoutes: RouteRecordRaw[] = [
  {
    path: PROTECTED_HOME_ROUTE,
    component: () => import("../app/layouts/SpaLayout.vue"),
    children: [
      {
        path: "",
        name: "overview",
        component: () => import("../app/pages/OverviewPage.vue")
      },
      {
        path: "account",
        name: "account",
        component: () => import("../app/pages/AccountPage.vue")
      },
      {
        path: "settings",
        name: "settings",
        component: () => import("../app/pages/SettingsPage.vue")
      }
    ]
  }
];
