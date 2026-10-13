# Newsletter browser coverage

These browser tests serve the real static site and intercept **all** outbound requests. Only the local static server is allowed through; newsletter POST responses are mocked and other external requests are blocked. They never contact the production API or send email.

```sh
npm install --no-save --prefix /tmp/newsletter-e2e @playwright/test@1.56.1
/tmp/newsletter-e2e/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/newsletter-e2e/node_modules /tmp/newsletter-e2e/node_modules/.bin/playwright test --config=tests/newsletter/playwright.config.cjs
```

If Chromium is already installed, set `CHROMIUM_PATH=/usr/bin/chromium` and skip downloading it. The local server requires port 4174. Screenshots are written under `test-results/newsletter/`; CI uploads them as an artifact. Do not commit generated results.

Desktop and mobile coverage includes inline validation/focus, clearing field errors, consent-independent status requests, all three authenticated status results, replay/invalid/unavailable responses, explicit action clicks, token removal from URL/history state, same-tab hash navigation, back/forward and leaving the page, stale asynchronous responses, timeout ambiguity, duplicate-submit prevention, and the existing footer confirmation modal. Existing cookie-consent tests remain in `tests/consent/` and are unchanged.
