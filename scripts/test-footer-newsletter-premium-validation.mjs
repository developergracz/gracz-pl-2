import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// Exercise the exact helper functions shipped by the shared footer JS.
// No DOM dependency, provider/network requests, production data or secrets.
const source = readFileSync(new URL('../maintenance-site/assets/legal-links.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function setFooterNewsletterFieldError(');
const end = source.indexOf('  function enhanceFooterNewsletter(', begin);
assert.ok(begin !== -1 && end > begin, 'Premium validation functions exist');
assert.ok(!source.includes('form.reportValidity()'), 'Native Chrome validation bubbles are removed');
const context = {};
runInNewContext(
  source.slice(begin, end) + '\nthis.validateFooterNewsletter = validateFooterNewsletter;' +
  '\nthis.setFooterNewsletterFieldError = setFooterNewsletterFieldError;',
  context,
);

function control(value = '', valid = true, checked = false) {
  const attributes = new Map();
  return {
    value, validity: { valid }, checked, attributes, focusCount: 0,
    setAttribute(key, value) { attributes.set(key, value); },
    removeAttribute(key) { attributes.delete(key); },
    focus() { this.focusCount += 1; },
  };
}

function fixture({ email = '', valid = true, consent = false } = {}) {
  const address = control(email, valid);
  const checkbox = control('', true, consent);
  const errors = { email: { textContent: '' }, consent: { textContent: '' } };
  return {
    address, checkbox, errors,
    form: {
      elements: { email: address, consent: checkbox },
      querySelector(selector) {
        if (selector === '[data-footer-newsletter-error="email"]') return errors.email;
        if (selector === '[data-footer-newsletter-error="consent"]') return errors.consent;
        return null;
      },
    },
  };
}

test('empty email and unchecked consent: both branded warnings, email receives focus', () => {
  const x = fixture();
  assert.equal(context.validateFooterNewsletter(x.form), false);
  assert.match(x.errors.email.textContent, /Podaj adres e-mail/);
  assert.match(x.errors.consent.textContent, /Zaznacz zgodę/);
  assert.equal(x.address.focusCount, 1);
  assert.equal(x.checkbox.focusCount, 0);
  assert.equal(x.address.attributes.get('aria-invalid'), 'true');
  assert.equal(x.checkbox.attributes.get('aria-invalid'), 'true');
});

test('malformed email: inline error even with consent', () => {
  const x = fixture({ email: 'not-an-email', valid: false, consent: true });
  assert.equal(context.validateFooterNewsletter(x.form), false);
  assert.match(x.errors.email.textContent, /Sprawdź adres e-mail/);
  assert.equal(x.errors.consent.textContent, '');
  assert.equal(x.address.focusCount, 1);
});

test('missing consent: checkbox receives focus without falsely marking email invalid', () => {
  const x = fixture({ email: 'jan@example.pl', consent: false });
  assert.equal(context.validateFooterNewsletter(x.form), false);
  assert.equal(x.errors.email.textContent, '');
  assert.match(x.errors.consent.textContent, /Zaznacz zgodę/);
  assert.equal(x.checkbox.focusCount, 1);
  assert.equal(x.address.attributes.has('aria-invalid'), false);
});

test('valid email and consent: passes validation and no warning remains', () => {
  const x = fixture({ email: 'jan@example.pl', consent: true });
  assert.equal(context.validateFooterNewsletter(x.form), true);
  assert.equal(x.errors.email.textContent, '');
  assert.equal(x.errors.consent.textContent, '');
  assert.equal(x.address.focusCount, 0);
  assert.equal(x.checkbox.focusCount, 0);
});

test('errors are removed after field correction without altering consent state', () => {
  const x = fixture();
  context.validateFooterNewsletter(x.form);
  x.address.value = 'jan@example.pl';
  x.address.validity.valid = true;
  context.setFooterNewsletterFieldError(x.form, 'email', '');
  assert.equal(x.errors.email.textContent, '');
  assert.equal(x.address.attributes.has('aria-invalid'), false);
  assert.match(x.errors.consent.textContent, /Zaznacz zgodę/);
  x.checkbox.checked = true;
  assert.equal(context.validateFooterNewsletter(x.form), true);
  assert.equal(x.checkbox.attributes.has('aria-invalid'), false);
});

test('Premium dialog explains already active addresses without exposing subscriber status', () => {
  assert.match(source,/Ten adres może być już aktywny/);
  assert.match(source,/aktywnych adresów nie zapisujemy ponownie/);
  assert.match(source,/nowy zapis wymaga potwierdzenia e-mail/);
  assert.match(source,/statusu adresu nie ujawniamy bez potwierdzenia/);
  assert.match(source,/target\.showModal\(\)/);
  assert.match(source,/data-newsletter-success-close/);
  assert.match(source,/Sprawdź swój status bezpiecznie/);
  assert.doesNotMatch(source,/<h2 id="newsletter-success-title">Zgłoszenie przyjęte<\/h2>/);
});
