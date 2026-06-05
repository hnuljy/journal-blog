<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { api } from "../services/api";

const loading = ref(true);
const posts = ref([]);
const errorMessage = ref("");

async function loadPosts() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const data = await api.get("/posts");
    posts.value = data.posts || [];
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadPosts);
</script>

<template>
  <div class="page-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Vue + Go Blog</p>
        <h1>Write, publish, and manage posts with a separated frontend and API.</h1>
        <p class="hero-copy">
          This starter keeps the public blog on Vue and the content API on Go so you can
          continue expanding auth, deployment, storage, and editor features.
        </p>
      </div>
      <div class="hero-actions">
        <RouterLink class="primary-link" to="/admin/login">Open Admin</RouterLink>
      </div>
    </header>

    <section class="section-card">
      <div class="section-heading">
        <h2>Published Posts</h2>
        <p>Posts are loaded from the Go API endpoint.</p>
      </div>

      <p v-if="loading" class="muted-text">Loading posts...</p>
      <p v-else-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <p v-else-if="posts.length === 0" class="muted-text">
        No published posts yet. Sign in to the admin panel and publish your first post.
      </p>

      <div v-else class="post-grid">
        <article v-for="post in posts" :key="post.id" class="post-card">
          <div class="post-card-top">
            <span class="status-badge published">{{ post.status }}</span>
            <span class="muted-text">{{ post.commentCount }} comments</span>
          </div>
          <h3>{{ post.title }}</h3>
          <p class="post-excerpt">{{ post.excerpt }}</p>
          <div class="post-card-bottom">
            <span class="muted-text">{{ new Date(post.updatedAt).toLocaleString() }}</span>
            <RouterLink :to="`/posts/${post.slug}`">Read post</RouterLink>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
