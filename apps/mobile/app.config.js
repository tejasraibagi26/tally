const { execSync } = require("node:child_process");

// app.json stays the single source of truth for everything else -- this
// file exists only because app.json is static JSON and can't run code, and
// a real git SHA has to be computed, not hand-maintained. Expo loads
// app.json first and passes it in as `config`; this just adds one field to
// `extra` and returns the rest untouched.
//
// EAS_BUILD_GIT_COMMIT_HASH is always set on an EAS Build/Update run
// (cloud build against a specific commit); the local `git` fallback covers
// `expo start`/`expo run:*` during development. Read at runtime via
// expo-constants -- see src/lib/version.ts.
function resolveBuildSha() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    buildSha: resolveBuildSha(),
  },
});
