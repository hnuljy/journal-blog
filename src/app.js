require("dotenv").config();

const express = require("express");
const path = require("node:path");
const helmet = require("helmet");
const morgan = require("morgan");
const methodOverride = require("method-override");
const cookieSession = require("cookie-session");

const adminRoutes = require("./routes/admin");
const publicRoutes = require("./routes/public");
const { isAuthenticated } = require("./middleware/auth");
const { flashMiddleware } = require("./middleware/flash");

const app = express();

app.set("trust proxy", 1);
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));

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
app.use(express.static(path.join(process.cwd(), "public")));
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

module.exports = app;
