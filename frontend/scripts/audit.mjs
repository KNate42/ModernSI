// Pre-delivery audit of the site sources: brand ban, placeholder words, pure black, forbidden fonts, the old term Hub and the banned
// voice words, empty links, and the intro engine being the exact file approved in the mock.
// This work made by Anfinogentov Nikita
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanned = ["src", "public"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".svg", ".json", ".md"]);
const checks = [
  { name: "brand word", pattern: /arizona|wildcats?|bear\s*down|\buofa\b/i },
  { name: "placeholder word", pattern: /lorem|ipsum|coming soon|\bTBD\b|\bTODO\b|\bFIXME\b/i },
  // The slide's colours are allowed now; pure black is not (tint shadows and text with the navy instead): #000, #000000 (also with alpha),
  // rgb()/rgba() written with commas or spaces, and the keyword
  { name: "pure black", pattern: /#0{3}(?:0{3})?(?:[0-9a-f]{1,2})?\b/i },
  { name: "pure black", pattern: /rgba?\(\s*0\s*[, ]\s*0\s*[, ]\s*0\b/i },
  { name: "pure black", pattern: /:\s*black\b|["']black["']/i },
  { name: "forbidden font", pattern: /proxima\s*nova|\bmilo\b/i },
  // The voice of the interface (spec 2026-10-07, section 7): "Hub" is not a term any more, and these words are banned in the interface
  { name: "old term Hub", pattern: /\bhub\b/i },
  { name: "banned voice word", pattern: /ecosystem|seamless|empower|leverage|digital hub|solutions|\bplatforms?\b/i },
  { name: "empty link", pattern: /href=(["'])#?\1|href=\{\s*(["'])#?\2\s*\}/ },
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return extensions.has(extname(path)) ? [path] : [];
  });
}

const problems = [];
const files = scanned.flatMap((dir) => walk(join(root, dir)));
for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line)) problems.push(`${relative(root, file)}:${index + 1}: ${check.name}: ${line.trim().slice(0, 120)}`);
    }
  });
}

const engine = readFileSync(join(root, "src/components/intro/engine.js"));
const mock = readFileSync(join(root, "../design/mock/intro.js"));
if (!engine.equals(mock)) problems.push("src/components/intro/engine.js: differs from design/mock/intro.js");

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\naudit failed: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`audit clean: ${files.length} files checked, engine matches the mock`);
