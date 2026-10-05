await Bun.$`bun scripts/build.ts`;
const web = Bun.spawn(["bun", "build", "src/web/index.html", "--outdir", "dist", "--public-path", "/", "--watch"], {
  stdout: "inherit",
  stderr: "inherit",
});
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = (portIndex >= 0 && args[portIndex + 1]) || "8787";
// Keep request URLs on localhost even though the config declares a custom domain route.
if (!args.includes("--host")) args.push("--host", `localhost:${port}`);
const worker = Bun.spawn(["bunx", "wrangler", "dev", ...args], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
const stop = () => {
  web.kill();
  worker.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await worker.exited;
web.kill();
