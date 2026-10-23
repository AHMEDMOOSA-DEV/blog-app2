import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const PAGE_SIZE = 6;

async function apiRequest(path, { signal, token, method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "The request could not be completed.");
  }

  return payload;
}

function getJson(path, signal, token) {
  return apiRequest(path, { signal, token });
}

function Header({ user, onLogout }) {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Fieldnotes home">
        <span className="brand-mark" aria-hidden="true">f.</span>
        <span>fieldnotes</span>
      </Link>
      <span className="header-note">Stories for a slower moment</span>
      <nav className="header-actions" aria-label="Account">
        <Link className="header-link" to="/">The journal <span aria-hidden="true">↘</span></Link>
        {user ? (
          <>
            <span className="header-user">Hi, {user.name}</span>
            <Link className="header-button" to="/new-post">Write a story +</Link>
            <button className="header-link header-logout" onClick={onLogout}>Sign out</button>
          </>
        ) : (
          <>
            <Link className="header-link" to="/login">Sign in</Link>
            <Link className="header-button" to="/register">Join us</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function PostCard({ post, index, user, token, onDeleted }) {
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deletePost() {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/api/posts/${encodeURIComponent(post.slug)}`, { method: "DELETE", token });
      onDeleted();
    } catch (error) {
      setDeleteError(error.message);
      setDeleting(false);
    }
  }

  return (
    <article className={`post-card post-card-${index % 3}`}>
      <Link
        className="post-cover"
        style={{ "--cover-color": post.coverColor }}
        to={`/posts/${post.slug}`}
        aria-label={`Read ${post.title}`}
      >
        <span className="cover-category">{post.category}</span>
        <span className="cover-art" aria-hidden="true">
          <span className="cover-sun" />
          <span className="cover-hill cover-hill-back" />
          <span className="cover-hill cover-hill-front" />
        </span>
        <span className="cover-arrow" aria-hidden="true">↗</span>
      </Link>
      <div className="post-card-body">
        <div className="post-meta">
          <span>{new Date(`${post.publishedAt}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}</span>
          <span className="meta-dot" />
          <span>{post.readTime} min read</span>
        </div>
        <h2><Link to={`/posts/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.excerpt}</p>
        <div className="post-card-footer">
          <span className="post-author">Words by {post.author}</span>
          {user && <button className="delete-post-button" onClick={deletePost} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>}
        </div>
        {deleteError && <p className="inline-error" role="alert">{deleteError}</p>}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="state-card" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>Gathering a few good stories…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card error-state" role="alert">
      <span className="state-icon" aria-hidden="true">!</span>
      <h2>We couldn't load the stories.</h2>
      <p>{message}</p>
      {onRetry && <button className="text-button" onClick={onRetry}>Try again <span aria-hidden="true">↗</span></button>}
    </div>
  );
}

function PostList({ user, token, refreshKey }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPage = Number(searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [deleteRefresh, setDeleteRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError("");

    getJson(`/api/posts?page=${page}&limit=${PAGE_SIZE}`, controller.signal)
      .then(setResult)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });

    return () => controller.abort();
  }, [page, retryToken, refreshKey, deleteRefresh]);

  function changePage(nextPage) {
    setSearchParams(nextPage === 1 ? {} : { page: String(nextPage) });
    document.getElementById("journal")?.scrollIntoView({ behavior: "smooth" });
  }

  const invalidPage = result && result.totalPages > 0 && page > result.totalPages;

  useEffect(() => {
    if (invalidPage) setSearchParams({});
  }, [invalidPage, setSearchParams]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line" /> THE FIELDNOTES JOURNAL</span>
          <h1>A little more<br /><em>room to notice.</em></h1>
          <p>Thoughtful stories about the everyday things that make a life.</p>
          <a className="hero-link" href="#journal">Explore the journal <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-sun" />
          <div className="hero-art-orbit" />
          <div className="hero-art-shape hero-art-shape-one" />
          <div className="hero-art-shape hero-art-shape-two" />
          <div className="hero-art-leaf">✳</div>
          <span className="hero-art-caption">NOTES ON A LIFE WELL NOTICED</span>
        </div>
        <span className="hero-index" aria-hidden="true">01 — 08</span>
      </section>

      <main id="journal" className="journal">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><span className="eyebrow-line" /> THE LATEST</span>
            <h2>From the journal<span className="heading-period">.</span></h2>
          </div>
          <span className="section-note">A collection of small<br />things worth remembering.</span>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setRetryToken((value) => value + 1)} />
        ) : !result ? (
          <LoadingState />
        ) : result.posts.length === 0 ? (
          <div className="state-card"><p>No stories found for this page.</p></div>
        ) : (
          <>
            <div className="post-grid">
              {result.posts.map((post, index) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  index={index}
                  user={user}
                  token={token}
                  onDeleted={() => setDeleteRefresh((value) => value + 1)}
                />
              ))}
            </div>
            <nav className="pagination" aria-label="Post pages">
              <button
                className="pagination-button"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
              >← <span>Previous</span></button>
              <div className="pagination-pages" aria-label={`Page ${page} of ${result.totalPages}`}>
                {Array.from({ length: result.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={`page-number${pageNumber === page ? " is-active" : ""}`}
                    onClick={() => changePage(pageNumber)}
                    aria-current={pageNumber === page ? "page" : undefined}
                    aria-label={`Page ${pageNumber}`}
                  >{String(pageNumber).padStart(2, "0")}</button>
                ))}
              </div>
              <button
                className="pagination-button"
                onClick={() => changePage(page + 1)}
                disabled={page >= result.totalPages}
                aria-label="Next page"
              ><span>Next</span> →</button>
            </nav>
            <p className="results-count">
              Showing {result.posts.length === 0 ? 0 : (page - 1) * result.limit + 1}–{Math.min(page * result.limit, result.total)} of {result.total} stories
            </p>
          </>
        )}
      </main>

      <footer className="site-footer">
        <Link className="brand footer-brand" to="/"><span className="brand-mark" aria-hidden="true">f.</span><span>fieldnotes</span></Link>
        <span>Made for the moments in between.</span>
        <a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Back to top ↑</a>
      </footer>
    </>
  );
}

function PostDetail({ user, token, onDeleted }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPost(null);
    setError("");

    getJson(`/api/posts/${encodeURIComponent(slug)}`, controller.signal)
      .then(setPost)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });

    return () => controller.abort();
  }, [slug]);

  async function deletePost() {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest(`/api/posts/${encodeURIComponent(post.slug)}`, { method: "DELETE", token });
      onDeleted();
      navigate("/");
    } catch (requestError) {
      setDeleteError(requestError.message);
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <main className="detail-main">
        <Link className="back-link" to="/">← Back to the journal</Link>
        <ErrorState message={error} />
      </main>
    );
  }

  if (!post) return <main className="detail-main"><LoadingState /></main>;

  return (
    <main className="detail-main">
      <Link className="back-link" to="/">← Back to the journal</Link>
      <article className="article">
        {user && (
          <div className="article-management">
            <Link className="header-button" to="/new-post">Write a story +</Link>
            <button className="delete-post-button" onClick={deletePost} disabled={deleting}>{deleting ? "Deleting…" : "Delete post"}</button>
          </div>
        )}
        {deleteError && <p className="inline-error" role="alert">{deleteError}</p>}
        <div className="article-heading">
          <span className="eyebrow"><span className="eyebrow-line" /> {post.category.toUpperCase()}</span>
          <h1>{post.title}<span className="heading-period">.</span></h1>
          <p className="article-excerpt">{post.excerpt}</p>
          <div className="article-byline">
            <span>Words by <strong>{post.author}</strong></span>
            <span className="meta-dot" />
            <time dateTime={post.publishedAt}>{new Date(`${post.publishedAt}T12:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric"
            })}</time>
            <span className="meta-dot" />
            <span>{post.readTime} min read</span>
          </div>
        </div>
        <div className="article-cover" style={{ "--cover-color": post.coverColor }} aria-hidden="true">
          <span className="article-cover-word">{post.category}</span>
          <span className="cover-art">
            <span className="cover-sun" />
            <span className="cover-hill cover-hill-back" />
            <span className="cover-hill cover-hill-front" />
          </span>
        </div>
        <div className="article-content">
          <span className="article-dropcap" aria-hidden="true">✳</span>
          {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <div className="article-endmark" aria-hidden="true">✳</div>
        </div>
      </article>
      <div className="article-back-bottom"><Link className="text-button" to="/">← More from the journal</Link></div>
    </main>
  );
}

function AuthPage({ mode, onAuthenticated }) {
  const navigate = useNavigate();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const session = await apiRequest(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: { ...(isRegister ? { name } : {}), email, password }
      });
      onAuthenticated(session);
      navigate("/");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="form-page">
      <Link className="back-link" to="/">← Back to the journal</Link>
      <section className="form-card">
        <span className="eyebrow"><span className="eyebrow-line" /> FIELDNOTES COMMUNITY</span>
        <h1>{isRegister ? "Make yourself at home." : "Welcome back."}</h1>
        <p>{isRegister ? "Create an account to share a story of your own." : "Sign in to publish and manage stories."}</p>
        <form className="stacked-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Your name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={60} required />
            </label>
          )}
          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 8 : undefined} maxLength={128} required />
            {isRegister && <span className="field-hint">Use at least 8 characters.</span>}
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={submitting}>{submitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"} <span aria-hidden="true">→</span></button>
        </form>
        <p className="form-switch">
          {isRegister ? "Already have an account?" : "New to Fieldnotes?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
        </p>
      </section>
    </main>
  );
}

function NewPostPage({ user, token, onCreated }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("");
  const [readTime, setReadTime] = useState("5");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const post = await apiRequest("/api/posts", {
        method: "POST",
        token,
        body: {
          title,
          excerpt,
          category,
          readTime: Number(readTime),
          content: content.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
        }
      });
      onCreated();
      navigate(`/posts/${post.slug}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="form-page new-post-page">
      <Link className="back-link" to="/">← Back to the journal</Link>
      <section className="form-card post-form-card">
        <span className="eyebrow"><span className="eyebrow-line" /> YOUR NEXT STORY</span>
        <h1>Put it into words.</h1>
        <p>Write something worth noticing. Separate paragraphs with a blank line.</p>
        <form className="stacked-form" onSubmit={handleSubmit}>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required /></label>
          <label>Short introduction<textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} minLength={10} maxLength={300} rows={3} required /></label>
          <div className="form-row">
            <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} minLength={2} maxLength={40} required /></label>
            <label>Read time (minutes)<input type="number" value={readTime} onChange={(event) => setReadTime(event.target.value)} min="1" max="120" required /></label>
          </div>
          <label>Story<textarea className="story-textarea" value={content} onChange={(event) => setContent(event.target.value)} rows={11} placeholder="Begin with the first thing you noticed…" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="submit" disabled={submitting}>{submitting ? "Publishing…" : "Publish story"} <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => ({
    user: null,
    token: localStorage.getItem("fieldnotes_token")
  }));
  const [authReady, setAuthReady] = useState(!session.token);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session.token) {
      setAuthReady(true);
      return;
    }
    let active = true;
    getJson("/api/auth/me", undefined, session.token)
      .then(({ user }) => {
        if (active) setSession((current) => ({ ...current, user }));
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem("fieldnotes_token");
          setSession({ user: null, token: null });
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => { active = false; };
  }, [session.token]);

  function handleAuthenticated(nextSession) {
    localStorage.setItem("fieldnotes_token", nextSession.token);
    setSession(nextSession);
  }

  function handleLogout() {
    localStorage.removeItem("fieldnotes_token");
    setSession({ user: null, token: null });
  }

  function refreshPosts() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <div id="top" className="app-shell">
      <Header user={session.user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<PostList user={session.user} token={session.token} refreshKey={refreshKey} />} />
        <Route path="/posts/:slug" element={<PostDetail user={session.user} token={session.token} onDeleted={refreshPosts} />} />
        <Route path="/login" element={session.user ? <Navigate to="/" replace /> : <AuthPage mode="login" onAuthenticated={handleAuthenticated} />} />
        <Route path="/register" element={session.user ? <Navigate to="/" replace /> : <AuthPage mode="register" onAuthenticated={handleAuthenticated} />} />
        <Route path="/new-post" element={!authReady ? <main className="form-page"><LoadingState /></main> : <NewPostPage user={session.user} token={session.token} onCreated={refreshPosts} />} />
        <Route path="*" element={<main className="detail-main"><div className="state-card"><span className="state-icon">404</span><h1>That page wandered off.</h1><Link className="text-button" to="/">Return to the journal →</Link></div></main>} />
      </Routes>
    </div>
  );
}
