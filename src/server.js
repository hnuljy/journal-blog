require("dotenv").config();

const app = require("./app");
const { initializeDatabase } = require("./db");

const port = Number(process.env.PORT || 3000);

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
