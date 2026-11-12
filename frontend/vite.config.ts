import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  test: {
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/App.tsx",
        "src/Account.tsx",
        "src/accountGateway.ts",
        "src/useAccount.ts",
        "src/DietaryFields.tsx",
        "src/Profile.tsx",
        "src/MealRequest.tsx",
        "src/profileStorage.ts",
        "src/selectionStorage.ts",
        "src/components/RecommendationDetails.tsx",
      ],
    },
  },
});
