export function withNewsletterLifecycleAnalytics(service, recorder) {
  if (!service || !recorder) return service;

  const overrides = {
    async subscribe(input) {
      const normalized = service.normalize(input?.email);
      const result = await service.subscribe(input);
      await bestEffort(() => recorder.captureSubscribe(normalized));
      return result;
    },

    async resendConfirmation(email) {
      const normalized = service.normalize(email);
      const result = await service.resendConfirmation(email);
      await bestEffort(() => recorder.captureResend(normalized));
      return result;
    },

    async confirm(token) {
      const hash = service.tokens.hash(String(token || ""));
      const context = await bestEffortLookup(() => recorder.findConfirmationContext(hash));
      const result = await service.confirm(token);
      if (context?.id) await bestEffort(() => recorder.captureConfirmed(context.id));
      return result;
    },

    async unsubscribeByToken(token) {
      const hash = service.tokens.hash(String(token || ""));
      const context = await bestEffortLookup(() => recorder.findUnsubscribeContext(hash));
      const result = await service.unsubscribeByToken(token);
      if (context?.id) await bestEffort(() => recorder.captureUnsubscribed(context.id));
      return result;
    },
  };

  return new Proxy(service, {
    get(target, property, receiver) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function bestEffort(operation) {
  try {
    await operation();
  } catch (error) {
    console.error("[newsletter-analytics] lifecycle recording failed", safeError(error));
  }
}

async function bestEffortLookup(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error("[newsletter-analytics] lifecycle lookup failed", safeError(error));
    return null;
  }
}

function safeError(error) {
  return {
    code: String(error?.code || "ERROR").slice(0, 80),
    name: String(error?.name || "Error").slice(0, 80),
  };
}
