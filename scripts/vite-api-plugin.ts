import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

type ApiModule = {
  default: (req: any, res: any) => Promise<void> | void;
};

const ROUTES: Record<string, () => Promise<ApiModule>> = {
  "/api/chat": () => import("../api/chat.ts"),
  "/api/plan": () => import("../api/plan.ts"),
  "/api/recommendations": () => import("../api/recommendations.ts"),
  "/api/spots": () => import("../api/spots.ts"),
  "/api/temple-nav": () => import("../api/temple-nav.ts"),
  "/api/translate": () => import("../api/translate.ts"),
  "/api/images/generate": () => import("../api/images/generate.ts"),
  "/api/places/lookup": () => import("../api/places/lookup.ts"),
  "/api/places/photo": () => import("../api/places/photo.ts"),
};

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) return JSON.parse(raw);
  return raw;
}

function queryObject(url: URL): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const current = query[key];
    query[key] = current == null
      ? value
      : Array.isArray(current) ? [...current, value] : [current, value];
  });
  return query;
}

function vercelResponse(res: ServerResponse): any {
  const apiRes = res as any;
  apiRes.status = (code: number) => {
    res.statusCode = code;
    return apiRes;
  };
  apiRes.json = (data: unknown) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return apiRes;
  };
  apiRes.send = (data: unknown) => {
    res.end(typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data));
    return apiRes;
  };
  apiRes.redirect = (statusOrUrl: number | string, maybeUrl?: string) => {
    const status = typeof statusOrUrl === "number" ? statusOrUrl : 302;
    const location = typeof statusOrUrl === "string" ? statusOrUrl : maybeUrl;
    if (location) res.setHeader("Location", location);
    res.statusCode = status;
    res.end();
    return apiRes;
  };
  return apiRes;
}

export function localApiPlugin(): Plugin {
  return {
    name: "local-vercel-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const loadRoute = ROUTES[url.pathname];
        if (!loadRoute) {
          next();
          return;
        }

        try {
          const apiReq = req as any;
          apiReq.query = queryObject(url);
          apiReq.body = await readBody(req);
          const module = await loadRoute();
          await module.default(apiReq, vercelResponse(res));
        } catch (error) {
          console.error(`[local-api] ${req.method} ${url.pathname}`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          if (!res.writableEnded) {
            res.end(JSON.stringify({ error: "Local API error", detail: error instanceof Error ? error.message : String(error) }));
          }
        }
      });
    },
  };
}