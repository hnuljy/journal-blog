<script setup>
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const errorMessage = ref("");
const form = reactive({
  email: "admin@example.com",
  password: "change-me-now"
});

async function submitLogin() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await auth.login(form);
    await router.push(route.query.redirect || "/admin");
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">Admin Access</p>
      <h1>Sign in to manage posts and comments.</h1>
      <p class="muted-text">
        Update the default admin credentials in the backend environment variables before
        deploying.
      </p>

      <form class="stacked-form" @submit.prevent="submitLogin">
        <label>
          <span>Email</span>
          <input v-model="form.email" type="email" required />
        </label>

        <label>
          <span>Password</span>
          <input v-model="form.password" type="password" required />
        </label>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? "Signing in..." : "Sign In" }}
        </button>
      </form>
    </section>
  </div>
</template>
