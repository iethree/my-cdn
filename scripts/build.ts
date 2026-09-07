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
console.log(`built ${result.outputs.length} files`);
