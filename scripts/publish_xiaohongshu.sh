#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRAFT_DIR="${ROOT_DIR}/frontend/public/xiaohongshu/drafts"
OUTBOX_DIR="${ROOT_DIR}/frontend/public/xiaohongshu/outbox"
DATE_STR="$(date +%F)"

mkdir -p "${DRAFT_DIR}" "${OUTBOX_DIR}"

usage() {
  cat <<'EOF'
Usage:
  scripts/publish_xiaohongshu.sh [draft_file]

Publish channels (choose one):
  1) XHS_PUBLISH_CMD:
     - A shell command that publishes a draft.
     - If it contains "{}", that token is replaced with draft path.
     - If not, draft path is appended as last arg.
     Example:
       export XHS_PUBLISH_CMD='node scripts/xhs_uploader.js --file {}'

  2) XHS_WEBHOOK_URL:
     - HTTP endpoint to receive form-data payload.
     - Fields: title, content, draft_file, date
     Example:
       export XHS_WEBHOOK_URL='https://hooks.zapier.com/hooks/catch/...'

  3) Local Playwright publisher (default fallback):
     - First-time login:
       node scripts/xhs_publish_playwright.mjs --login
     - Publish:
       node scripts/xhs_publish_playwright.mjs --file <draft>
     Optional env:
       XHS_AUTO_CONFIRM=1    # auto click publish button
       XHS_IMAGE_PATHS=a.png,b.png
       XHS_STRICT_VERIFY=0  # disable strict post-check (default: strict)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DRAFT_FILE="${1:-${DRAFT_DIR}/${DATE_STR}.md}"
if [[ ! -f "${DRAFT_FILE}" ]]; then
  echo "Draft not found: ${DRAFT_FILE}" >&2
  exit 2
fi

TITLE="$(grep -m1 '^# ' "${DRAFT_FILE}" | sed 's/^# //')"
if [[ -z "${TITLE}" ]]; then
  TITLE="$(grep -m1 '^Title:' "${DRAFT_FILE}" | sed 's/^Title:[[:space:]]*//')"
fi
if [[ -z "${TITLE}" ]]; then
  TITLE="AI教育日报 ${DATE_STR}"
fi

STATUS_FILE="${OUTBOX_DIR}/${DATE_STR}.status"
echo "date=${DATE_STR}" > "${STATUS_FILE}"
echo "draft=${DRAFT_FILE}" >> "${STATUS_FILE}"
echo "title=${TITLE}" >> "${STATUS_FILE}"

publish_via_cmd() {
  local cmd="${XHS_PUBLISH_CMD}"
  if [[ "${cmd}" == *"{}"* ]]; then
    cmd="${cmd//\{\}/${DRAFT_FILE}}"
  else
    cmd="${cmd} \"${DRAFT_FILE}\""
  fi
  echo "channel=command" >> "${STATUS_FILE}"
  bash -lc "${cmd}"
}

publish_via_webhook() {
  echo "channel=webhook" >> "${STATUS_FILE}"
  curl --fail --silent --show-error \
    -X POST "${XHS_WEBHOOK_URL}" \
    -F "title=${TITLE}" \
    -F "content=<${DRAFT_FILE}" \
    -F "draft_file=${DRAFT_FILE}" \
    -F "date=${DATE_STR}" >/dev/null
}

publish_via_playwright() {
  echo "channel=playwright" >> "${STATUS_FILE}"
  export XHS_MANUAL_SWITCH="${XHS_MANUAL_SWITCH:-1}"
  export XHS_SAVE_DRAFT="${XHS_SAVE_DRAFT:-1}"
  XHS_AUTO_CONFIRM="${XHS_AUTO_CONFIRM:-1}" \
    node "${ROOT_DIR}/scripts/xhs_publish_playwright.mjs" --file "${DRAFT_FILE}"
}

if [[ -n "${XHS_PUBLISH_CMD:-}" ]]; then
  publish_via_cmd
elif [[ -n "${XHS_WEBHOOK_URL:-}" ]]; then
  publish_via_webhook
else
  publish_via_playwright
fi

if [[ "${XHS_SAVE_DRAFT:-1}" == "1" ]]; then
  echo "status=drafted" >> "${STATUS_FILE}"
  echo "Draft saved successfully: ${DRAFT_FILE}"
else
  echo "status=published" >> "${STATUS_FILE}"
  echo "Published successfully: ${DRAFT_FILE}"
fi
