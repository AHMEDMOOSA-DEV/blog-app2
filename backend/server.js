import cors from "cors";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const app = express();
const port = Number(process.env.PORT) || 3001;
const postsFile = new URL("./data/posts.json", import.meta.url);
const usersFile = new URL("./data/users.json", import.meta.url);
let posts = JSON.parse(await readFile(postsFile, "utf8"));
let users = [];
try {
  users = JSON.parse(await readFile(usersFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set; login tokens will expire when the server restarts.");
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, jwtSecret, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Please sign in to continue." });

  try {
    request.auth = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return response.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

async function persistPosts() {
  await writeFile(postsFile, `${JSON.stringify(posts, null, 2)}\n`, "utf8");
}

async function persistUsers() {
  await writeFile(usersFile, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

app.post("/api/auth/register", async (request, response, next) => {
  try {
    const body = request.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 60) {
      return response.status(400).json({ error: "Name must be between 2 and 60 characters." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return response.status(400).json({ error: "Enter a valid email address." });
    }
    if (password.length < 8 || password.length > 128) {
      return response.status(400).json({ error: "Password must be between 8 and 128 characters." });
    }
    if (users.some((user) => user.email === email)) {
      return response.status(409).json({ error: "An account with this email already exists." });
    }

    const user = {
      id: randomUUID(),
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12)
    };
    users.push(user);
    try {
      await persistUsers();
    } catch (error) {
      users.pop();
      throw error;
    }
    response.status(201).json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  try {
    const body = request.body ?? {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = users.find((item) => item.email === email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }

    response.json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  const user = users.find((item) => item.id === request.auth.sub);
  if (!user) return response.status(401).json({ error: "Account not found. Please sign in again." });
  response.json({ user: publicUser(user) });
});

app.get("/api/posts", (request, response) => {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 6);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    return response.status(400).json({
      error: "Page must be a positive integer and limit must be between 1 and 50."
    });
  }

  const total = posts.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;

  response.json({
    posts: posts.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages
  });
});

app.get("/api/posts/:slug", (request, response) => {
  const post = posts.find((item) => item.slug === request.params.slug);

  if (!post) {
    return response.status(404).json({ error: "Post not found." });
  }

  response.json(post);
});

app.post("/api/posts", requireAuth, async (request, response, next) => {
  try {
    const { title, excerpt, category, content } = request.body ?? {};
    const cleanTitle = typeof title === "string" ? title.trim() : "";
    const cleanExcerpt = typeof excerpt === "string" ? excerpt.trim() : "";
    const cleanCategory = typeof category === "string" ? category.trim() : "";
    const paragraphs = Array.isArray(content)
      ? content.filter((paragraph) => typeof paragraph === "string").map((paragraph) => paragraph.trim()).filter(Boolean)
      : [];
    const readTime = Number(request.body?.readTime);

    if (cleanTitle.length < 3 || cleanTitle.length > 120) {
      return response.status(400).json({ error: "Title must be between 3 and 120 characters." });
    }
    if (cleanExcerpt.length < 10 || cleanExcerpt.length > 300) {
      return response.status(400).json({ error: "Excerpt must be between 10 and 300 characters." });
    }
    if (cleanCategory.length < 2 || cleanCategory.length > 40) {
      return response.status(400).json({ error: "Category must be between 2 and 40 characters." });
    }
    if (paragraphs.length < 1 || paragraphs.length > 30 || paragraphs.some((paragraph) => paragraph.length > 5000)) {
      return response.status(400).json({ error: "Add between 1 and 30 paragraphs, each no longer than 5000 characters." });
    }
    if (!Number.isInteger(readTime) || readTime < 1 || readTime > 120) {
      return response.status(400).json({ error: "Read time must be between 1 and 120 minutes." });
    }

    const baseSlug = cleanTitle.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "new-post";
    let slug = baseSlug;
    let suffix = 2;
    while (posts.some((item) => item.slug === slug)) slug = `${baseSlug}-${suffix++}`;

    const post = {
      slug,
      title: cleanTitle,
      excerpt: cleanExcerpt,
      author: request.auth.name,
      publishedAt: new Date().toISOString().slice(0, 10),
      category: cleanCategory,
      readTime,
      coverColor: "#dce7df",
      content: paragraphs
    };
    posts.unshift(post);
    try {
      await persistPosts();
    } catch (error) {
      posts.shift();
      throw error;
    }
    response.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/posts/:slug", requireAuth, async (request, response, next) => {
  try {
    const postIndex = posts.findIndex((item) => item.slug === request.params.slug);
    if (postIndex === -1) return response.status(404).json({ error: "Post not found." });

    const [deletedPost] = posts.splice(postIndex, 1);
    try {
      await persistPosts();
    } catch (error) {
      posts.splice(postIndex, 0, deletedPost);
      throw error;
    }
    response.json({ message: "Post deleted.", slug: deletedPost.slug });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }
  response.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(port, () => {
  console.log(`Blog API listening on http://localhost:${port}`);
});
