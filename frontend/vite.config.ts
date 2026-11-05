import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/App.tsx",
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
