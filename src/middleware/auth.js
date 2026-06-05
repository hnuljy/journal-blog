function isAuthenticated(req) {
  return Boolean(req.session && req.session.isAdmin);
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    return next();
  }

  req.session.flash = {
    type: "error",
    message: "Please sign in to continue."
  };

  return res.redirect("/admin/login");
}

module.exports = {
  isAuthenticated,
  requireAuth
};
