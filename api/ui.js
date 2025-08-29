function escapeHTML(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  try {
    // Obtener el texto desde la query (?text=...) con fallback a (?q=...)
    const url = new URL(req.url, "http://localhost");
    const textQ = req.query?.text ?? req.query?.q ?? url.searchParams.get("text") ?? url.searchParams.get("q") ?? "";
    const text = escapeHTML(String(textQ));
    const gifPath = "/assistant.gif"; // tu GIF en la raíz del proyecto

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const html = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="color-scheme" content="dark light">
<title>Asistente</title>
<style>
  :root{ color-scheme: dark; }
  body{
    margin:0; background:#0b0b0d; color:#fff;
    font-family:-apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    min-height:100vh; padding:24px; gap:18px;
  }
  img{ width:120px; height:120px; border-radius:24px; object-fit:cover; }
  .bubble{
    max-width:760px; width:calc(100% - 32px);
    background:#141418; border:1px solid #222; border-radius:16px;
    padding:16px 18px; box-shadow:0 6px 20px rgba(0,0,0,.25);
    font-size:18px; line-height:1.45; white-space:pre-wrap; word-wrap:break-word;
  }
</style>
</head>
<body>
  <img src="${gifPath}" alt="Assistant">
  <div class="bubble">${text || "..."}</div>
</body>
</html>`;

    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send(`<!doctype html><pre>UI error: ${String(e)}</pre>`);
  }
};
