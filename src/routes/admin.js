const express = require("express");
const {
  createPost,
  deleteComment,
  deletePost,
  getPostById,
  getPostBySlug,
  getStats,
  listAdminPosts,
  listAllComments,
  updatePost
} = require("../db");
const { isAuthenticated, requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");
const { formatDate } = require("../utils/format");
const { makeExcerpt, sanitizeText, slugify } = require("../utils/text");

const router = express.Router();

async function mapPostInput(body, existingId = null) {
  const title = sanitizeText(body.title);
  const requestedSlug = sanitizeText(body.slug);
  const content = sanitizeText(body.content);
  const excerpt = sanitizeText(body.excerpt) || makeExcerpt(content);
  const coverImage = sanitizeText(body.coverImage);
  const status = body.status === "published" ? "published" : "draft";
  const baseSlug = requestedSlug ? slugify(requestedSlug) : slugify(title);

  let nextSlug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await getPostBySlug(nextSlug);

    if (!existing || Number(existing.id) === Number(existingId)) {
      break;
    }

    counter += 1;
    nextSlug = `${baseSlug}-${counter}`;
  }

  return {
    content,
    coverImage,
    excerpt,
    slug: nextSlug,
    status,
    title
  };
}

router.get("/login", (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect("/admin");
  }

  res.render("admin/login", {
    pageTitle: "Admin Sign In"
  });
});

router.post("/login", (req, res) => {
  const email = sanitizeText(req.body.email).toLowerCase();
  const password = sanitizeText(req.body.password);
  const adminEmail = String(process.env.ADMIN_EMAIL || "").toLowerCase();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");

  if (email !== adminEmail || password !== adminPassword) {
    req.session.flash = {
      type: "error",
      message: "Invalid email or password."
    };

    return res.redirect("/admin/login");
  }

  req.session.isAdmin = true;
  req.session.flash = {
    type: "success",
    message: "Signed in successfully."
  };

  return res.redirect("/admin");
});

router.post("/logout", requireAuth, (req, res) => {
  req.session = null;
  return res.redirect("/");
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.render("admin/dashboard", {
      formatDate,
      pageTitle: "Dashboard",
      posts: await listAdminPosts(),
      stats: await getStats()
    });
  })
);

router.get("/posts/new", (req, res) => {
  res.render("admin/editor", {
    pageTitle: "New Post",
    post: {
      content: "",
      cover_image: "",
      excerpt: "",
      slug: "",
      status: "draft",
      title: ""
    },
    submitAction: "/admin/posts",
    submitLabel: "Create post"
  });
});

router.post(
  "/posts",
  asyncHandler(async (req, res) => {
    const input = await mapPostInput(req.body);

    if (!input.title || !input.content) {
      req.session.flash = {
        type: "error",
        message: "Title and content are required."
      };

      return res.redirect("/admin/posts/new");
    }

    const post = await createPost(input);

    req.session.flash = {
      type: "success",
      message: "Post saved successfully."
    };

    return res.redirect(`/admin/posts/${post.id}/edit`);
  })
);

router.get(
  "/posts/:id/edit",
  asyncHandler(async (req, res) => {
    const post = await getPostById(req.params.id);

    if (!post) {
      return res.status(404).render("not-found", {
        pageTitle: "Post Not Found"
      });
    }

    return res.render("admin/editor", {
      pageTitle: `Edit ${post.title}`,
      post,
      submitAction: `/admin/posts/${post.id}?_method=PUT`,
      submitLabel: "Save changes"
    });
  })
);

router.put(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const current = await getPostById(req.params.id);

    if (!current) {
      return res.status(404).render("not-found", {
        pageTitle: "Post Not Found"
      });
    }

    const input = await mapPostInput(req.body, current.id);

    if (!input.title || !input.content) {
      req.session.flash = {
        type: "error",
        message: "Title and content are required."
      };

      return res.redirect(`/admin/posts/${current.id}/edit`);
    }

    await updatePost(current.id, input);

    req.session.flash = {
      type: "success",
      message: "Post updated successfully."
    };

    return res.redirect(`/admin/posts/${current.id}/edit`);
  })
);

router.delete(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    await deletePost(req.params.id);

    req.session.flash = {
      type: "success",
      message: "Post deleted successfully."
    };

    return res.redirect("/admin");
  })
);

router.get(
  "/comments",
  asyncHandler(async (req, res) => {
    res.render("admin/comments", {
      comments: await listAllComments(),
      formatDate,
      pageTitle: "Comments"
    });
  })
);

router.delete(
  "/comments/:id",
  asyncHandler(async (req, res) => {
    await deleteComment(req.params.id);

    req.session.flash = {
      type: "success",
      message: "Comment deleted successfully."
    };

    return res.redirect("/admin/comments");
  })
);

module.exports = router;
