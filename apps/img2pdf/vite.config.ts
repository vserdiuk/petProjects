import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at the domain root, in a sub-folder
// (GitHub Pages: /<repo>/) and under /<slug>/ inside the portal.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // The PDF is built in a module worker (src/lib/pdf.worker.ts).
  worker: { format: "es" },
});
