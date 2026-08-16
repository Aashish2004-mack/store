import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites are served from https://<user>.github.io/<repo>/
// so the base path needs to match your repo name exactly (with slashes).
// Example: if your repo is "manga-store", set base to "/manga-store/".
// If you're deploying to a custom domain or root, leave it as "/".
export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || "/",
  plugins: [react()],
});

