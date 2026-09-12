import { Container, getContainer } from "@cloudflare/containers";

export class GraczPhp extends Container {
  defaultPort = 80;
  sleepAfter = "10m";
  enableInternet = true;

  override onStart() {
    console.log(JSON.stringify({ event: "gracz_php_started" }));
  }

  override onStop() {
    console.log(JSON.stringify({ event: "gracz_php_stopped" }));
  }

  override onError(error: unknown) {
    console.error(JSON.stringify({
      event: "gracz_php_error",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/__cloudflare/health") {
      return Response.json({ status: "ok", service: "gracz-pl" });
    }

    const container = getContainer(env.GRACZ_PHP, "gracz-php-primary");
    return container.fetch(request);
  },
} satisfies ExportedHandler<Env>;
