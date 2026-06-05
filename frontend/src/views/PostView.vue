<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { api } from "../services/api";

const route = useRoute();
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const post = ref(null);
const comments = ref([]);
const form = reactive({
  authorName: "",
  authorEmail: "",
  content: ""
});

async function loadPost() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const data = await api.get(`/posts/${route.params.slug}`);
    post.value = data.post;
    comments.value = data.comments || [];
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function submitComment() {
  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const data = await api.post(`/posts/${route.params.slug}/comments`, form);
    comments.value.unshift(data.comment);
    form.authorName = "";
    form.authorEmail = "";
    form.content = "";
    successMessage.value = "Comment posted successfully."
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    saving.value = false;
  }
}

watch(() => route.params.slug, loadPost);
onMounted(loadPost);
</script>

<template>
  <div class="page-shell">
    <section class="section-card">
      <p v-if="loading" class="muted-text">Loading post...</p>
      <p v-else-if="errorMessage && !post" class="error-text">{{ errorMessage }}</p>

      <template v-else-if="post">
        <div class="post-header">
          <RouterLink to="/">Back to home</RouterLink>
          <div>
            <span class="status-badge" :class="post.status">{{ post.status }}</span>
          </div>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <p class="muted-text">{{ new Date(post.updatedAt).toLocaleString() }}</p>
        <p class="post-excerpt">{{ post.excerpt }}</p>
        <div v-if="post.coverImage" class="cover-image-wrap">
          <img :src="post.coverImage" :alt="post.title" class="cover-image" />
        </div>
        <article class="post-content">{{ post.content }}</article>
      </template>
    </section>

    <section class="section-card">
      <div class="section-heading">
        <h2>Comments</h2>
        <p>{{ comments.length }} total</p>
      </div>

      <form class="comment-form" @submit.prevent="submitComment">
        <div class="form-grid two-columns">
          <label>
            <span>Name</span>
            <input v-model="form.authorName" type="text" maxlength="120" required />
          </label>
          <label>
            <span>Email</span>
            <input v-model="form.authorEmail" type="email" maxlength="180" />
          </label>
        </div>

        <label>
          <span>Comment</span>
          <textarea v-model="form.content" rows="5" maxlength="2000" required />
        </label>

        <div class="inline-feedback">
          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
          <p v-if="successMessage" class="success-text">{{ successMessage }}</p>
        </div>

        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? "Posting..." : "Post Comment" }}
        </button>
      </form>

      <div v-if="comments.length === 0" class="empty-state">
        No comments yet.
      </div>

      <div v-else class="comment-list">
        <article v-for="comment in comments" :key="comment.id" class="comment-card">
          <div class="comment-meta">
            <strong>{{ comment.authorName }}</strong>
            <span class="muted-text">{{ new Date(comment.createdAt).toLocaleString() }}</span>
          </div>
          <p>{{ comment.content }}</p>
        </article>
      </div>
    </section>
  </div>
</template>
