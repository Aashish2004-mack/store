import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base path ("./") means built asset URLs are relative rather than
// absolute, so they resolve correctly no matter what subfolder the site is
// served from (e.g. GitHub Pages project sites at /<repo-name>/). This
// avoids needing to know or inject the repo name at build time — a common
// source of blank-page deploys when the two don't match.
export default defineConfig({
  base: "./",
  plugins: [react()],
});


