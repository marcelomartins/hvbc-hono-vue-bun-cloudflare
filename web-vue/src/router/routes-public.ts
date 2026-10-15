import type { RouteRecordRaw } from "vue-router";

import ContactPage from "../public-pages/ContactPage.vue";
import HomePage from "../public-pages/HomePage.vue";
import LoginPage from "../public-pages/LoginPage.vue";
import NotFoundPage from "../public-pages/NotFoundPage.vue";
import PricingPage from "../public-pages/PricingPage.vue";
import RegisterPage from "../public-pages/RegisterPage.vue";
import PublicLayout from "../public-pages/layouts/PublicLayout.vue";

export const publicRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    component: PublicLayout,
    children: [
      { path: "", name: "home", component: HomePage },
      { path: "pricing", name: "pricing", component: PricingPage },
      { path: "contact", name: "contact", component: ContactPage },
      { path: "login", name: "login", component: LoginPage },
      { path: "register", name: "register", component: RegisterPage },
      { path: ":pathMatch(.*)*", name: "not-found", component: NotFoundPage }
    ]
  }
];
