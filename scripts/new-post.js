const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const postsDir = path.join(rootDir, "content", "posts");
const title = process.argv.slice(2).join(" ").trim();

if (!title) {
  console.error('Usage: npm run new-post -- "My Post Title"');
  process.exit(1);
}

const slug = slugify(title);
const date = new Date().toISOString().slice(0, 10);
const filePath = path.join(postsDir, `${date}-${slug}.md`);

if (fs.existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

fs.mkdirSync(postsDir, { recursive: true });
fs.writeFileSync(
  filePath,
  `---
title: ${title}
slug: ${slug}
date: ${date}
excerpt: Add a short summary here.
tags: notes
draft: false
---

## New post

Start writing here.
`,
  "utf8"
);

console.log(`Created ${filePath}`);

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}
