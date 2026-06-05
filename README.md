# Journal Blog

A starter blog system built with Vue 3 on the frontend and Go on the backend.

## Current direction

This repository is now organized around a separated frontend and backend:

- `frontend/`: Vue 3 + Vite + Vue Router + Pinia + Element Plus
- `backend/`: Go + Gin + GORM + PostgreSQL + JWT auth

The public site and admin panel now target these features:

- Public blog homepage
- Post detail page
- Visitor comments
- Admin login
- Admin dashboard
- Create, edit, publish, and delete posts
- Delete comments from the admin panel

The repository has been cleaned up to keep only the current `frontend/` + `backend/` architecture.

## Project structure

```text
frontend/
  src/
    router/
    services/
    stores/
    views/
backend/
  cmd/api/main.go
```

## Frontend setup

Create the frontend environment file:

```bash
copy frontend\\.env.example frontend\\.env
```

Install dependencies:

```bash
cd frontend
npm install
```

Start the Vue development server:

```bash
npm run dev
```

The default frontend URL is:

```text
http://localhost:5173
```

Frontend environment variables:

- `VITE_API_BASE_URL`: base URL of the Go API, default `http://localhost:8080/api/v1`

## Backend setup

Create the backend environment file:

```bash
copy backend\\.env.example backend\\.env
```

Set up PostgreSQL and update `DATABASE_URL`, then start the API:

```bash
cd backend
go mod tidy
go run ./cmd/api
```

The default backend URL is:

```text
http://localhost:8080
```

Backend environment variables:

- `APP_ENV`: `development` or `production`
- `PORT`: API port, default `8080`
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: token signing secret
- `ADMIN_EMAIL`: admin login email
- `ADMIN_PASSWORD`: admin login password
- `ADMIN_PASSWORD_HASH`: optional bcrypt hash, preferred for production
- `ALLOWED_ORIGINS`: comma-separated frontend origins

## Default admin login

The starter values are:

```text
Email: admin@example.com
Password: change-me-now
```

Change them before deploying.

## API overview

Public endpoints:

- `GET /health`
- `GET /api/v1/posts`
- `GET /api/v1/posts/:slug`
- `POST /api/v1/posts/:slug/comments`

Auth endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Admin endpoints:

- `GET /api/v1/admin/me`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/posts`
- `GET /api/v1/admin/posts/:id`
- `POST /api/v1/admin/posts`
- `PUT /api/v1/admin/posts/:id`
- `DELETE /api/v1/admin/posts/:id`
- `GET /api/v1/admin/comments`
- `DELETE /api/v1/admin/comments/:id`

## Root helper scripts

From the repository root:

```bash
npm run dev:frontend
npm run build:frontend
npm run preview:frontend
npm run dev:backend
```

The backend helper script requires Go to be installed and available on `PATH`.

## Free public deployment

Recommended stack for the current project:

- Frontend: Vercel project from `frontend/`
- Backend: Vercel project from `backend/`
- Database: Neon PostgreSQL or Supabase PostgreSQL

### 1. Create the database

Create a free PostgreSQL database on Neon or Supabase, then copy the connection string.

Save it for the backend project as:

```text
DATABASE_URL=your-postgres-url
```

Use the pooled connection string if the provider gives both pooled and direct URLs.

### 2. Deploy the backend on Vercel

The `backend/` directory already includes `go.mod` and `backend/vercel.json`.

1. Push the repository to GitHub.
2. In Vercel, create a new project from this repository.
3. Set the Root Directory to `backend`.
4. Set the Framework Preset to `Go` if Vercel does not auto-detect it.
5. Add these environment variables:

```text
APP_ENV=production
DATABASE_URL=your-postgres-url
JWT_SECRET=your-long-random-secret
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-password
ADMIN_PASSWORD_HASH=
ALLOWED_ORIGINS=https://your-frontend-project.vercel.app
```

6. Deploy the project.

After deployment, your backend URL will look similar to:

```text
https://your-backend-project.vercel.app
```

Test these URLs:

```text
https://your-backend-project.vercel.app/health
https://your-backend-project.vercel.app/api/v1/posts
```

### 3. Deploy the frontend on Vercel

The `frontend/` directory includes `frontend/vercel.json` so Vue Router routes can refresh correctly on Vercel.

1. In Vercel, create another new project from the same repository.
2. Set the Root Directory to `frontend`.
3. Let Vercel detect the Vite project automatically.
4. Add this environment variable:

```text
VITE_API_BASE_URL=https://your-backend-project.vercel.app/api/v1
```

5. Deploy the project.

The frontend production build reads `VITE_API_BASE_URL` at build time, so update the variable before redeploying.

### 4. Sync backend CORS

After the frontend deploy finishes, copy the final frontend domain back into the backend project:

```text
ALLOWED_ORIGINS=https://your-frontend-project.vercel.app
```

Then redeploy the backend once.

### 5. Sign in to the admin panel

Open:

```text
https://your-frontend-project.vercel.app/admin/login
```

Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values you configured in the backend Vercel project.

## Deployment checklist

- Push the current repository to GitHub
- Create a Neon or Supabase PostgreSQL database
- Deploy `backend/` to a Vercel project with Root Directory set to `backend`
- Set backend environment variables in Vercel
- Deploy `frontend/` to another Vercel project with Root Directory set to `frontend`
- Set `VITE_API_BASE_URL` in the frontend Vercel project
- Update `ALLOWED_ORIGINS` in the backend Vercel project
- Test homepage, post page, comment form, and admin login

## Next recommended steps

- Replace the textarea editor with a richer Markdown or rich-text editor
- Add image upload storage
- Add comment moderation and spam protection
- Add automated tests when the runtime toolchain is available
