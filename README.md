# Fieldnotes Blog

A small full-stack blog application with JSON-backed posts and accounts, a paginated Express API, and a React frontend. Visitors can register, sign in, publish, and delete posts.

## Requirements

- Node.js 18 or later
- npm 9 or later

## Run locally

From the project root:

```bash
npm install
npm run dev
```

The React app is available at `http://localhost:5173`; the API listens at `http://localhost:3001`. Vite proxies `/api` requests to the backend during development.

Set `JWT_SECRET` to a long, random value before starting the backend. If omitted, a temporary secret is generated and existing login tokens stop working when the server restarts.

## API

### `GET /api/posts?page=1&limit=6`

Returns one page of posts and pagination metadata:

```json
{
  "posts": [],
  "total": 8,
  "page": 1,
  "limit": 6,
  "totalPages": 2
}
```

`page` must be a positive integer. `limit` must be an integer from 1 to 50. Invalid pagination returns `400`.

### `GET /api/posts/:slug`

Returns the matching post, or `404` when no post has that slug.

### Authentication

- `POST /api/auth/register` — accepts `{ "name": "...", "email": "...", "password": "..." }`
- `POST /api/auth/login` — accepts `{ "email": "...", "password": "..." }`
- `GET /api/auth/me` — returns the current account; requires `Authorization: Bearer <token>`

Passwords must be at least 8 characters and are stored as bcrypt hashes in the ignored `backend/data/users.json` file.

### Protected post management

- `POST /api/posts` — create a post; requires a bearer token and accepts `title`, `excerpt`, `category`, `readTime`, and a `content` array of paragraphs. The signed-in account is recorded as the author.
- `DELETE /api/posts/:slug` — delete a post; requires a bearer token.

Post changes are written to `backend/data/posts.json`.

## Build and run

```bash
npm run build
npm start
```

Set `PORT` to change the API port. For a separately hosted frontend, set `VITE_API_BASE_URL` to the API origin when building and configure the API's allowed CORS origins for your deployment.

## Project structure

- `backend/data/posts.json` — static blog post content
- `backend/server.js` — Express API
- `frontend/src/App.jsx` — post list, pagination, and article views
- `frontend/src/styles.css` — responsive styling
