# Journal Blog

A lightweight full-stack blog website built with Express, EJS, PostgreSQL, and Render-ready deployment.

## Features

- Create draft posts from the admin dashboard
- Publish articles to the public homepage
- Accept reader comments on each post
- Manage posts and delete comments from `/admin`
- Deploy from GitHub with automatic redeploy on push

## Stack

- Node.js
- Express
- EJS templates
- PostgreSQL
- Render Blueprint

## Local setup

1. Copy `.env.example` to `.env`
2. Make sure PostgreSQL is available locally
3. Update `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Admin access

- Sign in at `/admin/login`
- Use the credentials from `.env`
- Create a draft or publish directly from the editor

## Render deployment

This project is prepared for GitHub to Render automatic deployment.

### Files already prepared

- `render.yaml`: creates the web service and PostgreSQL database
- `package.json`: includes the correct build and start commands
- `src/db.js`: initializes PostgreSQL tables automatically at startup

### What you need to do

1. Create a GitHub repository
2. Upload this project to GitHub
3. Create a Render account and connect GitHub
4. In Render, choose `New +` -> `Blueprint`
5. Select this GitHub repository
6. Render will read `render.yaml` and create:
   - one web service
   - one PostgreSQL database
7. Wait for deployment to finish
8. Open the generated `onrender.com` domain

### Important production changes after first deploy

After Render creates the service, go to the service environment settings and change:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `BASE_URL`

Set `BASE_URL` to your real Render address, for example:

```env
BASE_URL=https://your-service-name.onrender.com
```

### Environment variables

```env
PORT=3000
BASE_URL=http://localhost
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
DATABASE_URL=postgresql://journal_blog:journal_blog_password@localhost:5432/journal_blog
APP_DOMAIN=
```

## Optional Docker deployment

If you want to run it yourself with Docker instead of Render:

```bash
docker compose up -d --build
```

This starts:

- PostgreSQL
- The blog app
- Caddy reverse proxy
