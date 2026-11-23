// Collects every app build into one static site:
//   apps/portal/dist   -> dist/
//   apps/<slug>/dist   -> dist/<slug>/   (for each slug in projects.json)
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist");
const projects = JSON.parse(readFileSync(join(root, "projects.json"), "utf8"));

rmSync(out, { recursive: true, force: true });
cpSync(join(root, "apps/portal/dist"), out, { recursive: true });

for (const { slug } of projects) {
  const src = join(root, "apps", slug, "dist");
  if (!existsSync(src)) throw new Error(`Missing build for "${slug}" (${src})`);
  cpSync(src, join(out, slug), { recursive: true });
}

// GitHub Pages: skip Jekyll processing.
writeFileSync(join(out, ".nojekyll"), "");
console.log(`Assembled portal + ${projects.length} project(s) into dist/`);
