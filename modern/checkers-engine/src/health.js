export async function handleHealthRequest(request, response, { store } = {}) {
  if (request.method !== "GET") return false;

  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/health") {
    return sendJson(response, 200, { status: "ok" });
  }

  if (pathname === "/health/live") {
    return sendJson(response, 200, { status: "ok", probe: "liveness" });
  }

  if (pathname !== "/health/ready") return false;

  try {
    if (typeof store?.healthCheck === "function") {
      await store.healthCheck();
    }
    return sendJson(response, 200, { status: "ready", probe: "readiness" });
  } catch {
    return sendJson(response, 503, {
      status: "not-ready",
      probe: "readiness",
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
  return true;
}
