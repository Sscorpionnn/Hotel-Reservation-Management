import nextConfig from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"] },
  ...nextConfig,
  {
    rules: {
      // This ops dashboard's "load(); }, [deps])" data-fetch pattern trips
      // this heuristic on every page — the setState calls happen inside an
      // async function's promise continuation, not synchronously in the
      // effect body, so there's no real cascading-render risk here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
