import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// El backend (multimarket-backend) no se publica: solo vive en la red
// interna docker "front-back-network". El navegador llama a rutas /api/*
// del mismo origen público del frontend; este middleware las reenvía al
// backend interno para que nunca haya que exponerlo.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://backend:8000";

const apiProxyMiddleware = createMiddleware().server(async ({ request, pathname, next }) => {
  if (!pathname.startsWith("/api/")) {
    return await next();
  }

  const incomingUrl = new URL(request.url);
  const target = new URL(pathname + incomingUrl.search, BACKEND_URL);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const backendResponse = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: backendResponse.headers,
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [apiProxyMiddleware, errorMiddleware],
}));
