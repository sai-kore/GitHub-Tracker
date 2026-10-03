import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { validateEnv } from "./config/env.js";
import { startScheduler } from "./services/scheduler.js";

const PORT =
  process.env.PORT || 5000;


async function startServer() {
  try {
    validateEnv();

    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });

    startScheduler();

  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exit(1);
  }
}


startServer();