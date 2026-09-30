#!/usr/bin/env bash
# Renders participant-guide.html -> participant-guide.pdf using headless Chrome.
#
# Values are injected at render time and never stored in the HTML, so the source
# stays safe to commit. Anything you leave unset renders as a fill-in box.
#
#   SYSTEM_URL=https://rso.example.com \
#   FACULTY_CODE_A=AAA FACULTY_CODE_B=BBB \
#   SUS_FORM_URL=https://forms.gle/xxxx \
#   ADMIN_EMAIL=admin@example.com ADMIN_PW='...' \
#   ./render-pdf.sh
#
# Read the admin values from your password manager or a local env file rather
# than typing them into your shell history:
#   set -a; . ./.render.env; set +a; ./render-pdf.sh
#
# The rendered PDF carries the shared admin login, so it is gitignored. Send it
# to testers directly; do not commit it or put it anywhere public.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="$DIR/participant-guide.html"
TMP="$DIR/.build.html"
OUT="${OUT_PDF:-$DIR/participant-guide.pdf}"

cp "$SRC" "$TMP"
trap 'rm -f "$TMP"' EXIT

# With no admin login supplied, cut the shared-account panel out of the markup
# rather than leaving an empty fill-in box. The element is removed, not just
# hidden, so nothing survives as an invisible text layer — this is the build
# that is safe to put behind a public Drive link.
if [ -z "${ADMIN_EMAIL:-}" ]; then
  python3 - "$TMP" <<'EOF'
import re, sys
path = sys.argv[1]
with open(path) as f: text = f.read()
text, n = re.subn(
    r'<div class="panel warn admin-only".*?</div>\s*', '', text, flags=re.S)
if n != 1:
    sys.exit(f'expected 1 admin-only panel, removed {n} — check the markup')
with open(path, 'w') as f: f.write(text)
EOF
fi

substitute() {                       # substitute <placeholder> <value>
  [ -z "$2" ] && return 0
  python3 - "$TMP" "$1" "$2" <<'EOF'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f: text = f.read()
with open(path, 'w') as f: f.write(text.replace(key, val))
EOF
}

substitute __SYSTEM_URL__     "${SYSTEM_URL:-}"
substitute __FACULTY_CODE_A__ "${FACULTY_CODE_A:-}"
substitute __FACULTY_CODE_B__ "${FACULTY_CODE_B:-}"
substitute __SUS_FORM_URL__   "${SUS_FORM_URL:-}"
substitute __ADMIN_EMAIL__    "${ADMIN_EMAIL:-}"
substitute __ADMIN_PW__       "${ADMIN_PW:-}"

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" "file://$TMP" 2>/dev/null

echo "→ $OUT"
grep -o '__[A-Z_]*__' "$TMP" | sort -u | sed 's/^/   still unfilled: /' || true
