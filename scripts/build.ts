// Favicon: rack.svg with its main color swapped for APP_COLOR from wrangler.jsonc, generated before bundling.
const SVG_MAIN_COLOR = /#7a0099/gi;
async function appColor(): Promise<string> {
  for (const file of ["wrangler.jsonc", "wrangler.template.jsonc"]) {
    try {
      const text = (await Bun.file(file).text()).replace(/^\s*\/\/.*$/gm, "");
      const color = JSON.parse(text)?.vars?.APP_COLOR;
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    } catch {}
  }
  return "#9d03fc";
}
const color = await appColor();
await Bun.write("src/web/favicon.svg", (await Bun.file("src/web/rack.svg").text()).replace(SVG_MAIN_COLOR, color));

await Bun.$`rm -rf dist`;
const result = await Bun.build({
  entrypoints: ["src/web/index.html"],
  outdir: "dist",
  target: "browser",
  publicPath: "/",
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await Bun.write("dist/_headers", Bun.file("src/web/_headers"));
console.log(`built ${result.outputs.length} files, favicon ${color}`);
