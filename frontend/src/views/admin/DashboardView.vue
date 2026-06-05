<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";

const auth = useAuthStore();
const router = useRouter();
const loading = ref(true);
const errorMessage = ref("");
const dashboard = ref({
  comments: [],
  posts: [],
  stats: {
    commentCount: 0,
    postCount: 0,
    publishedCount: 0
  }
});

async function loadDashboard() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const data = await api.get("/admin/dashboard", auth.accessToken);
    dashboard.value = data;
  } catch (error) {
    errorMessage.value = error.message;
  } finally {
    loading.value = false;
  }
}

async function removePost(id) {
  await api.delete(`/admin/posts/${id}`, auth.accessToken);
  await loadDashboard();
}

async function removeComment(id) {
  await api.delete(`/admin/comments/${id}`, auth.accessToken);
  await loadDashboard();
}

async function signOut() {
  await auth.logout();
  await router.push("/admin/login");
}

onMounted(loadDashboard);
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <div>
        <p class="eyebrow">Admin Panel</p>
        <h1>Content dashboard</h1>
      </div>
      <div class="hero-actions">
        <button class="secondary-button" type="button" @click="router.push('/')">View Site</button>
        <button class="primary-button" type="button" @click="router.push('/admin/posts/new')">
          New Post
        </button>
        <button class="secondary-button" type="button" @click="signOut">Sign Out</button>
      </div>
    </header>

    <p v-if="loading" class="muted-text">Loading dashboard...</p>
    <p v-else-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <template v-else>
      <section class="stats-grid">
        <article class="stat-card">
          <span class="muted-text">Posts</span>
          <strong>{{ dashboard.stats.postCount }}</strong>
        </article>
        <article class="stat-card">
          <span class="muted-text">Published</span>
          <strong>{{ dashboard.stats.publishedCount }}</strong>
        </article>
        <article class="stat-card">
          <span class="muted-text">Comments</span>
          <strong>{{ dashboard.stats.commentCount }}</strong>
        </article>
      </section>

      <section class="section-card">
        <div class="section-heading">
          <h2>Posts</h2>
          <p>Manage draft and published content.</p>
        </div>

        <div v-if="dashboard.posts.length === 0" class="empty-state">No posts yet.</div>
        <div v-else class="table-list">
          <article v-for="post in dashboard.posts" :key="post.id" class="table-row">
            <div>
              <strong>{{ post.title }}</strong>
              <p class="muted-text">
                {{ post.status }} · {{ post.commentCount }} comments ·
                {{ new Date(post.updatedAt).toLocaleString() }}
              </p>
            </div>
            <div class="row-actions">
              <button
                class="secondary-button"
                type="button"
                @click="router.push(`/admin/posts/${post.id}/edit`)"
              >
                Edit
              </button>
              <button class="danger-button" type="button" @click="removePost(post.id)">
                Delete
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="section-card">
        <div class="section-heading">
          <h2>Comments</h2>
          <p>Review and delete incoming comments.</p>
        </div>

        <div v-if="dashboard.comments.length === 0" class="empty-state">No comments yet.</div>
        <div v-else class="table-list">
          <article v-for="comment in dashboard.comments" :key="comment.id" class="table-row">
            <div>
              <strong>{{ comment.authorName }}</strong>
              <p class="muted-text">
                {{ comment.post?.title || "Unknown post" }} ·
                {{ new Date(comment.createdAt).toLocaleString() }}
              </p>
              <p>{{ comment.content }}</p>
            </div>
            <button class="danger-button" type="button" @click="removeComment(comment.id)">
              Delete
            </button>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
