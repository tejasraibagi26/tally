/**
 * Mock-data flag: dev defaults to mock (no Plaid credentials needed to run
 * the app locally), production defaults to live. MOCK_DATA explicitly
 * overrides either direction — e.g. to exercise real Plaid Sandbox in dev,
 * or to smoke-test the mock path against a production build.
 */
export const MOCK_MODE: boolean =
  process.env.MOCK_DATA != null ? process.env.MOCK_DATA === "true" : process.env.NODE_ENV !== "production";
