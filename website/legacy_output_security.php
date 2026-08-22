<?php
/**
 * Defense-in-depth filter for legacy PHP-rendered HTML.
 * This is not a substitute for context-aware escaping, but it blocks the
 * most dangerous legacy stored/reflected XSS primitives while individual
 * templates are being modernized.
 */

function gracz_legacy_filter_html($html)
{
    if (!is_string($html) || $html === '') {
        return $html;
    }

    // JSON/XML/binary responses must not be modified.
    $contentType = '';
    foreach (headers_list() as $header) {
        if (stripos($header, 'Content-Type:') === 0) {
            $contentType = strtolower($header);
            break;
        }
    }
    if ($contentType !== '' &&
        strpos($contentType, 'text/html') === false &&
        strpos($contentType, 'application/xhtml+xml') === false) {
        return $html;
    }

    // Remove dangerous active-content elements that should never be supplied
    // by ordinary user-controlled profile/message data.
    $html = preg_replace('#<(?:iframe|object|embed|applet|meta|base)\b[^>]*>.*?</(?:iframe|object|embed|applet)>#is', '', $html);
    $html = preg_replace('#<(?:iframe|object|embed|applet|meta|base)\b[^>]*/?>#is', '', $html);

    // Remove inline event handlers (onclick, onerror, onload, ...).
    $html = preg_replace('/\s+on[a-z0-9_-]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html);

    // Neutralize script-capable URI schemes in HTML attributes.
    $html = preg_replace('/\b(href|src|action|formaction)\s*=\s*(["\'])\s*(?:javascript|vbscript|data\s*:\s*text\/html)\s*:[^\2]*\2/i', '$1="#"', $html);
    $html = preg_replace('/\b(href|src|action|formaction)\s*=\s*(?:javascript|vbscript)\s*:[^\s>]+/i', '$1="#"', $html);

    return $html;
}

function gracz_legacy_enable_output_security()
{
    if (PHP_SAPI !== 'cli' && !headers_sent()) {
        ob_start('gracz_legacy_filter_html');
    }
}
