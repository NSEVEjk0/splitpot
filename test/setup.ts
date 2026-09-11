// Test environment defaults. These run before any module imports config,
// so the app reads a self-contained, in-memory setup during tests.
process.env.ADMIN_TOKEN = "test-admin";
process.env.MOOVE_API_KEY = "test-key";
process.env.MOOVE_API_BASE_URL = "https://api.moove.test";
process.env.MOOVE_HANDLE = "@ckay";
process.env.HOST_KEY_SECRET = "test-host-key-secret";
process.env.SPLITPOT_DB_URL = ":memory:";

// Ensure nothing tries to read a real dotenv file during tests.
process.env.SPLITPOT_SKIP_DOTENV = "1";
