import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('[startup] Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`[startup] Server listening on http://localhost:${env.PORT}`);
  });
}

start();

