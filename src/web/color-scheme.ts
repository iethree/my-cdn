try {
  const stored = localStorage.getItem("mantine-color-scheme-value") || "auto";
  const scheme = stored === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : stored;
  document.documentElement.setAttribute("data-mantine-color-scheme", scheme);
} catch {}
