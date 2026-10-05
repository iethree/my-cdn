-- better-auth's rate limiter keeps counters here (rateLimit.storage = "database").
-- Its default in-memory store is per isolate, which on Workers barely limits anything.
CREATE TABLE "rateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "count" INTEGER NOT NULL,
  "lastRequest" INTEGER NOT NULL
);
