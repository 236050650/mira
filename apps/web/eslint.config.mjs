import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "worker/**",
    "db/**",
    "examples/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Product UI intentionally syncs route/theme/demo mode from external systems.
      // Keep core-web-vitals; relax React Compiler purity rules that false-positive on handlers.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
