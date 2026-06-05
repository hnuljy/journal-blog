<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const form = reactive({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  status: "draft"
});

const isEditing = computed(() => Boolean(route.params.id));

async function loadPost() {
  if (!isEditing.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const data = await api.get(`/admin/posts/${route.params.id}`, auth.accessToken);
    Object.assign(form, data.post);
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function submitPost() {
  saving.value = true;
  errorMessage.value = "";

  try {
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      status: form.status
    };

    if (isEditing.value) {
      await api.put(`/admin/posts/${route.params.id}`, payload, auth.accessToken);
    } else {
      await api.post("/admin/posts", payload, auth.accessToken);
    }

    await router.push("/admin");
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    saving.value = false;
  }
}

onMounted(loadPost);
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <div>
        <p class="eyebrow">Post Editor</p>
        <h1>{{ isEditing ? "Edit post" : "Create post" }}</h1>
      </div>
      <div class="hero-actions">
        <button class="secondary-button" type="button" @click="router.push('/admin')">
          Back
        </button>
      </div>
    </header>

    <p v-if="loading" class="muted-text">Loading post...</p>

    <form v-else class="section-card stacked-form" @submit.prevent="submitPost">
      <div class="form-grid two-columns">
        <label>
          <span>Title</span>
          <input v-model="form.title" type="text" maxlength="180" required />
        </label>

        <label>
          <span>Slug</span>
          <input v-model="form.slug" type="text" maxlength="180" placeholder="auto-from-title" />
        </label>
      </div>

      <label>
        <span>Excerpt</span>
        <textarea v-model="form.excerpt" rows="3" maxlength="300" />
      </label>

      <label>
        <span>Cover image</span>
        <input v-model="form.coverImage" type="url" maxlength="500" />
      </label>

      <label>
        <span>Status</span>
        <select v-model="form.status">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>

      <label>
        <span>Content</span>
        <textarea v-model="form.content" rows="16" maxlength="50000" required />
      </label>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <button class="primary-button" type="submit" :disabled="saving">
        {{ saving ? "Saving..." : "Save Post" }}
      </button>
    </form>
  </div>
</template>
