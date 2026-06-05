const app = require("../src/app");
const { initializeDatabase } = require("../src/db");

module.exports = async (req, res) => {
  await initializeDatabase();
  return app(req, res);
};
