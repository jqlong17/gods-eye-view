- Cloudflare Pages CSP `frame-ancestors` now also allows local onto Bot
  origins (`http://127.0.0.1:9072`, `http://localhost:9072`, and CSP Level 3
  port wildcards `http://127.0.0.1:*` / `http://localhost:*`) so a loopback
  host can iframe the public Pages globe without dropping the existing
  `self` / `onto-demo.pages.dev` / `*.pages.dev` allowlist (jqlong17, #4).
