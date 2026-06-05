import { defineStore } from "pinia";

import { api } from "../services/api";

const STORAGE_KEY = "journal-blog-access-token";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    accessToken: localStorage.getItem(STORAGE_KEY) || "",
    initialized: false,
    user: null
  }),
  getters: {
    isAuthenticated(state) {
      return Boolean(state.accessToken);
    }
  },
  actions: {
    setToken(token) {
      this.accessToken = token || "";

      if (this.accessToken) {
        localStorage.setItem(STORAGE_KEY, this.accessToken);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    async login(payload) {
      const data = await api.post("/auth/login", payload);
      this.setToken(data.accessToken);
      this.user = data.user;
      this.initialized = true;
      return data;
    },
    async refresh() {
      const data = await api.post("/auth/refresh", {});
      this.setToken(data.accessToken);
      this.user = data.user;
      this.initialized = true;
      return data;
    },
    async logout() {
      try {
        await api.post("/auth/logout", {}, this.accessToken);
      } finally {
        this.setToken("");
        this.user = null;
        this.initialized = true;
      }
    },
    async fetchMe() {
      if (!this.accessToken) {
        this.user = null;
        this.initialized = true;
        return null;
      }

      const data = await api.get("/admin/me", this.accessToken);
      this.user = data.user;
      this.initialized = true;
      return data.user;
    },
    async ensureSession() {
      if (this.initialized && this.isAuthenticated) {
        return this.user;
      }

      if (this.accessToken) {
        try {
          return await this.fetchMe();
        } catch (error) {
          this.setToken("");
        }
      }

      try {
        const data = await this.refresh();
        return data.user;
      } catch (error) {
        this.setToken("");
        this.user = null;
        this.initialized = true;
        return null;
      }
    }
  }
});
