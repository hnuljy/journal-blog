# Journal Blog

A lightweight full-stack blog website built with Express, EJS, PostgreSQL, and a Vercel-friendly serverless entry.

## Features

- Create draft posts from the admin dashboard
- Publish articles to the public homepage
- Accept reader comments on each post
- Manage posts and delete comments from `/admin`
- Deploy from GitHub with automatic redeploy on push
- Use Supabase PostgreSQL for persistent cloud data

## Stack

- Node.js
- Express
- EJS templates
- PostgreSQL
- Vercel
- Supabase

## Local setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Admin access

- Sign in at `/admin/login`
- Use the credentials from `.env`
- Create a draft or publish directly from the editor

## Vercel deployment

This project is prepared for GitHub to Vercel deployment.

### Files already prepared

- `api/index.js`: Vercel serverless entry
- `vercel.json`: rewrites all requests into the Express app and bundles `views` and `public`
- `src/server.js`: local development entry
- `src/db.js`: initializes PostgreSQL tables automatically at startup

### Step 1: Create a Supabase project

1. Sign in to Supabase
2. Create a new project
3. Wait for the database to finish provisioning
4. Open `Project Settings` -> `Database`
5. Copy the PostgreSQL connection string

For Vercel, the pooled connection string is recommended.

### Step 2: Import this repository into Vercel

1. Sign in to Vercel
2. Click `Add New...` -> `Project`
3. Import the GitHub repository
4. Keep the default framework detection as `Other`
5. Do not change the root directory

### Step 3: Set environment variables in Vercel

Add these variables before the first deployment:

```env
DATABASE_URL=postgresql://postgres:password@db.example.supabase.co:5432/postgres
SESSION_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
BASE_URL=https://your-project.vercel.app
```

Notes:

- `DATABASE_URL`: use the Supabase connection string
- `SESSION_SECRET`: use a long random value
- `BASE_URL`: set it to your Vercel production domain
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: change them to your own values

### Step 4: Deploy

1. Click `Deploy`
2. Wait for the first build to finish
3. Open the generated `vercel.app` domain
4. Sign in at `/admin/login`

## Optional Docker deployment

If you want to run it yourself with Docker instead of Vercel:

```bash
docker compose up -d --build
```

This starts:

- PostgreSQL
- The blog app
- Caddy reverse proxy
