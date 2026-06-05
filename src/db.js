const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://journal_blog:journal_blog_password@localhost:5432/journal_blog";

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString,
  ssl: isProduction
    ? {
        rejectUnauthorized: false
      }
    : false
});

let initializationPromise;

async function rawQuery(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function query(text, params = [], options = {}) {
  try {
    return await rawQuery(text, params);
  } catch (error) {
    if (error && error.code === "42P01" && !options.skipAutoInit) {
      await initializeDatabase();
      return rawQuery(text, params);
    }

    throw error;
  }
}

async function initializeDatabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    await query(
      `
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
      [],
      { skipAutoInit: true }
    );

    await query(
      `
    CREATE TABLE IF NOT EXISTS comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_email TEXT DEFAULT '',
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
      [],
      { skipAutoInit: true }
    );

    await query(
      `
    CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
    ON posts (status, published_at DESC, created_at DESC);
  `,
      [],
      { skipAutoInit: true }
    );

    await query(
      `
    CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at
    ON comments (post_id, created_at DESC);
  `,
      [],
      { skipAutoInit: true }
    );
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

function now() {
  return new Date().toISOString();
}

async function listPublishedPosts() {
  return query(
    `SELECT *
     FROM posts
     WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC`
  );
}

async function listAdminPosts() {
  return query(
    `SELECT posts.*,
            (SELECT COUNT(*)::int FROM comments WHERE comments.post_id = posts.id) AS comment_count
     FROM posts
     ORDER BY updated_at DESC`
  );
}

async function getPublishedPostBySlug(slug) {
  const rows = await query(
    `SELECT *
     FROM posts
     WHERE slug = $1 AND status = 'published'
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function getPostById(id) {
  const rows = await query(
    `SELECT *
     FROM posts
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getPostBySlug(slug) {
  const rows = await query(
    `SELECT *
     FROM posts
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function createPost(input) {
  const timestamp = now();
  const publishedAt = input.status === "published" ? timestamp : null;
  const rows = await query(
    `INSERT INTO posts (slug, title, excerpt, content, cover_image, status, published_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.slug,
      input.title,
      input.excerpt,
      input.content,
      input.coverImage || "",
      input.status,
      publishedAt,
      timestamp,
      timestamp
    ]
  );

  return rows[0] || null;
}

async function updatePost(id, input) {
  const existing = await getPostById(id);

  if (!existing) {
    return null;
  }

  const timestamp = now();
  const publishedAt = input.status === "published" ? existing.published_at || timestamp : null;
  const rows = await query(
    `UPDATE posts
     SET slug = $1,
         title = $2,
         excerpt = $3,
         content = $4,
         cover_image = $5,
         status = $6,
         published_at = $7,
         updated_at = $8
     WHERE id = $9
     RETURNING *`,
    [
      input.slug,
      input.title,
      input.excerpt,
      input.content,
      input.coverImage || "",
      input.status,
      publishedAt,
      timestamp,
      id
    ]
  );

  return rows[0] || null;
}

async function deletePost(id) {
  await query(
    `DELETE FROM posts
     WHERE id = $1`,
    [id]
  );
}

async function listCommentsForPost(postId) {
  return query(
    `SELECT *
     FROM comments
     WHERE post_id = $1
     ORDER BY created_at DESC`,
    [postId]
  );
}

async function listAllComments() {
  return query(
    `SELECT comments.*, posts.title AS post_title, posts.slug AS post_slug
     FROM comments
     JOIN posts ON posts.id = comments.post_id
     ORDER BY comments.created_at DESC`
  );
}

async function createComment(postId, input) {
  const rows = await query(
    `INSERT INTO comments (post_id, author_name, author_email, content, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [postId, input.authorName, input.authorEmail || "", input.content, now()]
  );

  return rows[0] || null;
}

async function deleteComment(id) {
  await query(
    `DELETE FROM comments
     WHERE id = $1`,
    [id]
  );
}

async function getStats() {
  const [postRow] = await query(`SELECT COUNT(*)::int AS count FROM posts`);
  const [publishedRow] = await query(
    `SELECT COUNT(*)::int AS count FROM posts WHERE status = 'published'`
  );
  const [commentRow] = await query(`SELECT COUNT(*)::int AS count FROM comments`);

  return {
    commentCount: commentRow ? Number(commentRow.count) : 0,
    postCount: postRow ? Number(postRow.count) : 0,
    publishedCount: publishedRow ? Number(publishedRow.count) : 0
  };
}

module.exports = {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getPostById,
  getPostBySlug,
  getPublishedPostBySlug,
  getStats,
  initializeDatabase,
  listAdminPosts,
  listAllComments,
  listCommentsForPost,
  listPublishedPosts,
  updatePost
};
