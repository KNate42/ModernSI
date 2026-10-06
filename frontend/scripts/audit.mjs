// Pre-delivery audit of the site sources: brand ban, placeholder words, forbidden colours and fonts,
// empty links, and the intro engine being the exact file approved in the mock.
// This work made by Anfinogentov Nikita
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanned = ["src", "public"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".svg", ".json", ".md"]);
const forbiddenHex = ["AB0520", "0C234B", "001C48", "1E5288", "8B0015", "EF4056", "81D3EB", "378DBD", "007D84", "70B865", "A95C42"];

// the same colours written as rgb()/rgba()
const forbiddenRgb = forbiddenHex.map((hex) => {
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\b`;
});

const checks = [
  { name: "brand word", pattern: /arizona|wildcats?|bear\s*down|\buofa\b/i },
  { name: "placeholder word", pattern: /lorem|ipsum|coming soon|\bTBD\b|\bTODO\b|\bFIXME\b/i },
  { name: "forbidden colour", pattern: new RegExp(`#(${forbiddenHex.join("|")})\\b`, "i") },
  { name: "forbidden colour", pattern: new RegExp(forbiddenRgb.join("|"), "i") },
  { name: "forbidden font", pattern: /proxima\s*nova|\bmilo\b/i },
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
