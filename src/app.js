require("dotenv").config();

const express = require("express");
const path = require("node:path");
const helmet = require("helmet");
const morgan = require("morgan");
const methodOverride = require("method-override");
const cookieSession = require("cookie-session");
const { initializeDatabase } = require("./db");

const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const { isAuthenticated } = require("./middleware/auth");
const { flashMiddleware } = require("./middleware/flash");

const app = express();
const port = Number(process.env.PORT || 3000);

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(
  cookieSession({
    name: "blog_session",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secret: process.env.SESSION_SECRET || "development-session-secret",
    secure: process.env.NODE_ENV === "production"
  })
);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(flashMiddleware);
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.isAdmin = isAuthenticated(req);
  res.locals.siteTitle = "Journal Blog";
  next();
});

app.use(publicRoutes);
app.use("/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).render("not-found", {
    pageTitle: "Page Not Found"
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).render("error", {
    pageTitle: "Server Error"
  });
});

async function start() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log(`Journal Blog is running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start Journal Blog:", error);
  process.exit(1);
});
