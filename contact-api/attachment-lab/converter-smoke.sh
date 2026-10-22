#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ "${GRACZ_ATTACHMENT_LAB_ONLY:-}" != "1" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "DENIED: only disposable GitHub Actions lab." >&2; exit 3
fi
for cmd in convert identify pandoc gs file unzip; do
  command -v "$cmd" >/dev/null || { echo "Missing tool: $cmd" >&2; exit 3; }
done
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
timeout 90s convert -limit memory 128MiB -limit map 256MiB -size 32x32 'xc:#15465a' "$work/source.png"
timeout 90s convert -limit memory 128MiB -limit map 256MiB "$work/source.png" -strip "$work/out.jpg"
timeout 90s convert -limit memory 128MiB -limit map 256MiB "$work/out.jpg" -strip "$work/back.png"
[[ "$(file -b --mime-type "$work/out.jpg")" == "image/jpeg" ]]
[[ "$(file -b --mime-type "$work/back.png")" == "image/png" ]]
[[ "$(identify -format '%wx%h' "$work/out.jpg")" == "32x32" ]]
printf '# gracz.pl sample\n\n**Synthetic sample only.**\n' > "$work/source.md"
timeout 90s pandoc -f markdown -t html5 -s "$work/source.md" -o "$work/out.html"
timeout 90s pandoc -f markdown "$work/source.md" -o "$work/out.docx"
grep -q 'gracz.pl' "$work/out.html"
unzip -tqq "$work/out.docx"
cat > "$work/source.ps" <<'PS'
%!PS-Adobe-3.0
/Helvetica findfont 12 scalefont setfont
72 740 moveto
(gracz.pl synthetic sample) show
showpage
PS
timeout 90s gs -q -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -sOutputFile="$work/out.pdf" "$work/source.ps"
[[ "$(file -b --mime-type "$work/out.pdf")" == "application/pdf" ]]
echo "PASS PNG-JPG-PNG, MD-HTML-DOCX, PS-PDF; production untouched."
