const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createComment,
  getPublishedPostBySlug,
  listCommentsForPost,
  listPublishedPosts
} = require("../db");
const { asyncHandler } = require("../utils/async-handler");
const { formatDate } = require("../utils/format");
const { sanitizeText } = require("../utils/text");

const router = express.Router();

const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many comments from this IP. Please try again later."
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const posts = await listPublishedPosts();

    res.render("home", {
      pageTitle: "Journal Blog",
      posts,
      formatDate
    });
  })
);

router.get(
  "/posts/:slug",
  asyncHandler(async (req, res) => {
    const post = await getPublishedPostBySlug(req.params.slug);

    if (!post) {
      return res.status(404).render("not-found", {
        pageTitle: "Post Not Found"
      });
    }

    const comments = await listCommentsForPost(post.id);

    return res.render("post", {
      comments,
      formatDate,
      pageTitle: post.title,
      post
    });
  })
);

router.post(
  "/posts/:slug/comments",
  commentLimiter,
  asyncHandler(async (req, res) => {
    const post = await getPublishedPostBySlug(req.params.slug);

    if (!post) {
      return res.status(404).render("not-found", {
        pageTitle: "Post Not Found"
      });
    }

    const authorName = sanitizeText(req.body.authorName);
    const authorEmail = sanitizeText(req.body.authorEmail);
    const content = sanitizeText(req.body.content);

    if (!authorName || !content) {
      req.session.flash = {
        type: "error",
        message: "Name and comment are required."
      };

      return res.redirect(`/posts/${post.slug}`);
    }

    await createComment(post.id, {
      authorEmail,
      authorName,
      content
    });

    req.session.flash = {
      type: "success",
      message: "Comment posted successfully."
    };

    return res.redirect(`/posts/${post.slug}#comments`);
  })
);

module.exports = router;
