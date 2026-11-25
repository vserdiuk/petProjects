import { defineConfig } from "vite";

// Relative base so the build works at the domain root, in a sub-folder
// (GitHub Pages: /<repo>/) and under /<slug>/ inside the portal.
export default defineConfig({
  base: "./",
});
