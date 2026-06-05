import { createRouter, createWebHistory } from "vue-router";

import { useAuthStore } from "../stores/auth";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import PostView from "../views/PostView.vue";
import DashboardView from "../views/admin/DashboardView.vue";
import EditorView from "../views/admin/EditorView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView
    },
    {
      path: "/posts/:slug",
      name: "post",
      component: PostView
    },
    {
      path: "/admin/login",
      name: "admin-login",
      component: LoginView
    },
    {
      path: "/admin",
      name: "admin-dashboard",
      component: DashboardView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/admin/posts/new",
      name: "admin-new-post",
      component: EditorView,
      meta: {
        requiresAuth: true
      }
    },
    {
      path: "/admin/posts/:id/edit",
      name: "admin-edit-post",
      component: EditorView,
      meta: {
        requiresAuth: true
      }
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!to.meta.requiresAuth) {
    return true;
  }

  await auth.ensureSession();

  if (auth.isAuthenticated) {
    return true;
  }

  return {
    name: "admin-login",
    query: {
      redirect: to.fullPath
    }
  };
});

export default router;
