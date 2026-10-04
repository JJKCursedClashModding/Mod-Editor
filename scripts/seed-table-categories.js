// Dumps the CURRENT effective table groups (wiki-derived, incl. "Other")
// into tableCategories.js as { category -> tables[] } so you can edit them.
//
// Usage: npm run seed-categories
const fs = require("fs");
const path = require("path");

require("../lib/config").load();
const schema = require("../lib/schema");

function main() {
  const tables = schema.listTables();
  const groups = new Map(); // label -> files[]
  for (const t of tables) {
    const label = t.groupLabel || "Other";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(t.file);
  }
  const names = [...groups.keys()].sort((a, b) =>
    a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b),
  );
  for (const n of names) groups.get(n).sort((a, b) => a.localeCompare(b));

  const lines = [];
  lines.push("// Table categories override — EDIT ME.");
  lines.push("//");
  lines.push("// Seeded from the wiki groups via `npm run seed-categories`.");
  lines.push("// Move file names between categories, rename categories, or add new");
  lines.push("// ones. Entries match the file, base name, or family (case-insensitive).");
  lines.push("// Tables NOT listed here fall back to the wiki group, then \"Other\".");
  lines.push("// Restart the editor (or change Settings) after editing this file.");
  lines.push("// Re-running `npm run seed-categories` overwrites this file.");
  lines.push("");
  lines.push("module.exports = {");
  names.forEach((name, i) => {
    const files = groups.get(name);
    lines.push(`  ${JSON.stringify(name)}: [`);
    files.forEach((f, j) => {
      lines.push(`    ${JSON.stringify(f)}${j < files.length - 1 ? "," : ""}`);
    });
    lines.push(`  ]${i < names.length - 1 ? "," : ""}`);
  });
  lines.push("};");
  lines.push("");

  const out = path.join(__dirname, "..", "tableCategories.js");
  fs.writeFileSync(out, lines.join("\n"));
  const total = names.reduce((n, k) => n + groups.get(k).length, 0);
  console.log(`Wrote ${out}: ${names.length} categories, ${total} tables.`);
  for (const n of names) console.log(`  ${n}: ${groups.get(n).length}`);
}

main();
