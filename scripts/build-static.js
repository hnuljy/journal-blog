const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content");
const postsDir = path.join(contentDir, "posts");
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

buildSite();

function buildSite() {
  const site = normalizeSiteConfig(readJson(path.join(contentDir, "site.json")));
  const posts = loadPosts(site);

  resetDirectory(distDir);
  copyDirectory(publicDir, distDir);
  writeText(path.join(distDir, ".nojekyll"), "");

  writeText(
    path.join(distDir, "index.html"),
    renderLayout({
      site,
      pageTitle: site.title,
      pageDescription: site.description,
      currentPath: "/",
      canonicalUrl: site.siteUrl,
      content: renderHome(site, posts)
    })
  );

  writeText(path.join(distDir, "404.html"), renderNotFound(site));

  for (const post of posts) {
    const postDir = path.join(distDir, "posts", post.slug);
    ensureDirectory(postDir);

    writeText(
      path.join(postDir, "index.html"),
      renderLayout({
        site,
        pageTitle: post.title,
        pageDescription: post.excerpt,
        currentPath: "/posts/",
        canonicalUrl: new URL(`posts/${post.slug}/`, site.siteUrl).toString(),
        content: renderPost(site, post)
      })
    );
  }

  console.log(`Built ${posts.length} published post(s) into ${distDir}`);
}

function normalizeSiteConfig(site) {
  const siteUrl = ensureTrailingSlash(site.siteUrl || "https://example.github.io/journal-blog/");
  const basePath = normalizeBasePath(site.basePath || new URL(siteUrl).pathname);

  return {
    ...site,
    siteUrl,
    basePath,
    navigation: Array.isArray(site.navigation) ? site.navigation : [],
    comments: site.comments || {}
  };
}

function loadPosts(site) {
  if (!fs.existsSync(postsDir)) {
    return [];
  }

  return fs
    .readdirSync(postsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => buildPost(site, path.join(postsDir, fileName)))
    .filter((post) => !post.draft)
    .sort((left, right) => right.timestamp - left.timestamp);
}

function buildPost(site, filePath) {
  const rawFile = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontMatter(rawFile);
  const fallbackSlug = slugify(path.basename(filePath, path.extname(filePath)));
  const slug = slugify(data.slug || fallbackSlug);
  const timestamp = getTimestamp(data.date);

  return {
    slug,
    title: data.title || fallbackSlug,
    excerpt: data.excerpt || createExcerpt(body),
    coverImage: data.coverImage || "",
    draft: toBoolean(data.draft),
    date: formatDate(timestamp),
    timestamp,
    tags: normalizeTags(data.tags),
    readingTime: estimateReadingTime(body),
    contentHtml: renderMarkdown(body),
    sourcePath: path.relative(rootDir, filePath).replace(/\\/g, "/"),
    editUrl: buildEditUrl(site, filePath)
  };
}

function renderLayout({ site, pageTitle, pageDescription, currentPath, canonicalUrl, content }) {
  const title = pageTitle === site.title ? site.title : `${pageTitle} | ${site.title}`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttribute(pageDescription || site.description)}" />
    <link rel="canonical" href="${escapeAttribute(canonicalUrl)}" />
    <link rel="stylesheet" href="${escapeAttribute(withBasePath(site.basePath, "/styles.css"))}" />
  </head>
  <body>
    <div class="shell">
      <header class="site-header">
        <a class="brand" href="${escapeAttribute(withBasePath(site.basePath, "/"))}">${escapeHtml(site.title)}</a>
        <nav class="nav">${renderNavigation(site, currentPath)}</nav>
      </header>
      <main class="page">${content}</main>
      <footer class="site-footer">
        <p>${escapeHtml(site.footerText || "Built with Markdown and GitHub Pages.")}</p>
        <p class="footer-note">${year} · ${escapeHtml(site.author?.name || site.title)}</p>
      </footer>
    </div>
  </body>
</html>`;
}

function renderNavigation(site, currentPath) {
  return site.navigation
    .map((item) => {
      const href = item.href || "/";
      const targetHref = normalizeNavigationHref(site, href);
      const external = /^(https?:)?\/\//.test(href);
      const active = isActiveLink(currentPath, href);
      const activeClass = active ? ' class="active"' : "";
      const extraAttributes = external ? ' target="_blank" rel="noreferrer"' : "";

      return `<a${activeClass} href="${escapeAttribute(targetHref)}"${extraAttributes}>${escapeHtml(item.label || "Link")}</a>`;
    })
    .join("");
}

function renderHome(site, posts) {
  const cards = posts.length
    ? posts.map((post) => renderPostCard(site, post)).join("")
    : `<div class="empty-state"><h3>No posts yet</h3><p>Add a Markdown file inside <code>content/posts</code> and push it to GitHub.</p></div>`;

  return `<section class="hero">
    <p class="eyebrow">Static publishing</p>
    <h1>${escapeHtml(site.tagline || "Write, publish, and share your ideas.")}</h1>
    <p class="hero-copy">${escapeHtml(site.description)}</p>
    <div class="hero-actions">
      <a class="button" href="#posts">Browse posts</a>
      <a class="text-link" href="${escapeAttribute(withBasePath(site.basePath, "/#writing-guide"))}">Writing guide</a>
    </div>
  </section>

  <section class="panel" id="writing-guide">
    <div class="section-heading">
      <h2>How publishing works</h2>
    </div>
    <div class="card-grid compact-grid">
      <article class="card"><div class="card-body"><h3>1. Create a file</h3><p>Add a new Markdown file to <code>content/posts</code>.</p></div></article>
      <article class="card"><div class="card-body"><h3>2. Write content</h3><p>Use front matter for title, slug, date, and optional cover image or tags.</p></div></article>
      <article class="card"><div class="card-body"><h3>3. Push to GitHub</h3><p>The Pages workflow rebuilds the site automatically on every push to <code>main</code>.</p></div></article>
    </div>
  </section>

  <section class="list-section" id="posts">
    <div class="section-heading">
      <h2>Latest posts</h2>
      <span>${posts.length} published</span>
    </div>
    <div class="card-grid">${cards}</div>
  </section>`;
}

function renderPostCard(site, post) {
  const cover = post.coverImage
    ? `<img class="cover-image" src="${escapeAttribute(post.coverImage)}" alt="${escapeAttribute(post.title)}" />`
    : "";
  const tags = post.tags.length
    ? `<div class="tag-list">${post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";

  return `<article class="card">
    ${cover}
    <div class="card-body">
      <p class="meta">${escapeHtml(post.date)} · ${post.readingTime}</p>
      <h3><a href="${escapeAttribute(withBasePath(site.basePath, `/posts/${post.slug}/`))}">${escapeHtml(post.title)}</a></h3>
      <p>${escapeHtml(post.excerpt)}</p>
      ${tags}
      <a class="text-link" href="${escapeAttribute(withBasePath(site.basePath, `/posts/${post.slug}/`))}">Read post</a>
    </div>
  </article>`;
}

function renderPost(site, post) {
  const cover = post.coverImage
    ? `<img class="post-cover" src="${escapeAttribute(post.coverImage)}" alt="${escapeAttribute(post.title)}" />`
    : "";
  const tags = post.tags.length
    ? `<div class="tag-list">${post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";

  return `<article class="post-layout">
    <div class="post-main post-article">
      <div class="post-header">
        <p class="meta">${escapeHtml(post.date)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta-row">
          <span>${post.readingTime}</span>
          <span>Source: <code>${escapeHtml(post.sourcePath)}</code></span>
        </div>
        ${tags}
      </div>
      ${cover}
      <div class="post-content prose">${post.contentHtml}</div>
      <div class="post-actions">
        <a class="text-link" href="${escapeAttribute(withBasePath(site.basePath, "/"))}">Back to home</a>
        <a class="text-link" href="${escapeAttribute(post.editUrl)}" target="_blank" rel="noreferrer">Edit on GitHub</a>
      </div>
    </div>
    <aside class="post-sidebar">${renderComments(site)}</aside>
  </article>`;
}

function renderComments(site) {
  const comments = site.comments || {};
  const hasGiscusConfig = [comments.repo, comments.repoId, comments.category, comments.categoryId].every(Boolean);

  if (comments.enabled && comments.provider === "giscus" && hasGiscusConfig) {
    return `<section class="comment-box">
      <h2>Comments</h2>
      <div class="giscus"></div>
      <script
        src="https://giscus.app/client.js"
        data-repo="${escapeAttribute(comments.repo)}"
        data-repo-id="${escapeAttribute(comments.repoId)}"
        data-category="${escapeAttribute(comments.category)}"
        data-category-id="${escapeAttribute(comments.categoryId)}"
        data-mapping="${escapeAttribute(comments.mapping || "pathname")}"
        data-strict="${escapeAttribute(comments.strict || "0")}"
        data-reactions-enabled="${escapeAttribute(comments.reactionsEnabled || "1")}"
        data-emit-metadata="${escapeAttribute(comments.emitMetadata || "0")}"
        data-input-position="${escapeAttribute(comments.inputPosition || "top")}"
        data-theme="${escapeAttribute(comments.theme || "light")}"
        data-lang="en"
        crossorigin="anonymous"
        async
      ></script>
    </section>`;
  }

  return `<section class="comment-box">
    <h2>Comments</h2>
    <p class="muted">This static blog does not store comments on the server. Configure Giscus in <code>content/site.json</code> if you want GitHub Discussions-based comments.</p>
    <p><a class="text-link" href="https://giscus.app/" target="_blank" rel="noreferrer">Open Giscus setup</a></p>
  </section>`;
}

function renderNotFound(site) {
  return renderLayout({
    site,
    pageTitle: "Page not found",
    pageDescription: site.description,
    currentPath: "/404",
    canonicalUrl: new URL("404/", site.siteUrl).toString(),
    content: `<section class="panel narrow"><h1>Page not found</h1><p>The page you requested does not exist.</p><a class="button" href="${escapeAttribute(withBasePath(site.basePath, "/"))}">Return home</a></section>`
  });
}

function parseFrontMatter(fileContent) {
  const normalized = fileContent.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return { data: {}, body: normalized.trim() };
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    data[key] = parseFrontMatterValue(rawValue);
  }

  return {
    data,
    body: match[2].trim()
  };
}

function parseFrontMatterValue(value) {
  if (!value) {
    return "";
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value.includes(",")) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return value;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];
  let listType = "";
  let blockquote = [];
  let codeLines = [];
  let codeLanguage = "";
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) {
      return;
    }
    html.push(`<${listType}>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${listType}>`);
    listItems = [];
    listType = "";
  };

  const flushBlockquote = () => {
    if (!blockquote.length) {
      return;
    }
    html.push(`<blockquote>${renderMarkdown(blockquote.join("\n"))}</blockquote>`);
    blockquote = [];
  };

  const flushCodeBlock = () => {
    const languageClass = codeLanguage ? ` class="language-${escapeAttribute(codeLanguage)}"` : "";
    html.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    codeLanguage = "";
    inCodeBlock = false;
  };

  for (const line of lines) {
    const codeFence = line.match(/^```\s*([\w-]+)?\s*$/);
    if (codeFence) {
      flushParagraph();
      flushList();
      flushBlockquote();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        inCodeBlock = true;
        codeLanguage = codeFence[1] || "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      blockquote.push(blockquoteMatch[1]);
      continue;
    }

    flushBlockquote();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      html.push(`<h${headingMatch[1].length}>${renderInline(headingMatch[2])}</h${headingMatch[1].length}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      html.push("<hr />");
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushBlockquote();
  if (inCodeBlock) {
    flushCodeBlock();
  }

  return html.join("\n");
}

function renderInline(value) {
  const tokens = [];
  let text = escapeHtml(value);

  text = text.replace(/`([^`]+)`/g, (_, code) => storeToken(tokens, `<code>${escapeHtml(code)}</code>`));
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_, alt, url) =>
      storeToken(tokens, `<img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}" loading="lazy" />`)
  );
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const external = /^(https?:)?\/\//.test(url);
    const attributes = external ? ' target="_blank" rel="noreferrer"' : "";
    return storeToken(tokens, `<a href="${escapeAttribute(url)}"${attributes}>${escapeHtml(label)}</a>`);
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return restoreTokens(text, tokens);
}

function storeToken(tokens, html) {
  const placeholder = `@@TOKEN_${tokens.length}@@`;
  tokens.push(html);
  return placeholder;
}

function restoreTokens(text, tokens) {
  return text.replace(/@@TOKEN_(\d+)@@/g, (_, index) => tokens[Number(index)] || "");
}

function createExcerpt(markdown) {
  const plainText = stripMarkdown(markdown).replace(/\s+/g, " ").trim();
  return plainText.length <= 160 ? plainText : `${plainText.slice(0, 157)}...`;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#-]/g, " ");
}

function estimateReadingTime(markdown) {
  const wordCount = stripMarkdown(markdown)
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 220));
  return `${minutes} min read`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(timestamp));
}

function getTimestamp(value) {
  const parsed = Date.parse(value || Date.now());
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function normalizeTags(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function toBoolean(value) {
  return value === true || value === "true";
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

function buildEditUrl(site, filePath) {
  const githubLink = (site.navigation || []).find(
    (item) => item.label === "GitHub" && /github\.com/.test(item.href || "")
  );
  if (!githubLink) {
    return site.siteUrl;
  }

  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  return `${githubLink.href.replace(/\/$/, "")}/edit/main/${relativePath}`;
}

function normalizeNavigationHref(site, href) {
  return /^(https?:)?\/\//.test(href) ? href : withBasePath(site.basePath, href);
}

function isActiveLink(currentPath, href) {
  const comparableHref = href.replace(/#.*$/, "");
  return comparableHref === "/" ? currentPath === "/" : currentPath.startsWith(comparableHref);
}

function withBasePath(basePath, href) {
  if (/^(https?:)?\/\//.test(href)) {
    return href;
  }

  const cleanedBasePath = normalizeBasePath(basePath);
  const cleanedHref = `/${String(href || "/").replace(/^\/+/, "")}`.replace(/\/+/g, "/");

  if (cleanedHref === "/") {
    return cleanedBasePath || "/";
  }

  return `${cleanedBasePath}${cleanedHref}`.replace(/\/+/g, "/");
}

function normalizeBasePath(value) {
  const pathname = String(value || "").trim();
  if (!pathname || pathname === "/") {
    return "";
  }
  return `/${pathname.replace(/^\/+|\/+$/g, "")}`;
}

function ensureTrailingSlash(value) {
  return String(value).endsWith("/") ? String(value) : `${String(value)}/`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resetDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
  ensureDirectory(directory);
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDirectory(destination);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function writeText(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(String(value));
}
