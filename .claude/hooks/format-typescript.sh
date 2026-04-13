#!/bin/bash
# TypeScript/TSX 파일 포매팅 훅 (PostToolUse)
# stdin으로 JSON 입력 수신

FILE=$(python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# prettier가 설치된 경우만 실행 (frontend 디렉토리 기준)
FRONTEND_DIR="$CLAUDE_PROJECT_DIR/frontend"
[ ! -d "$FRONTEND_DIR" ] && exit 0

cd "$FRONTEND_DIR" || exit 0
command -v npx >/dev/null 2>&1 || exit 0

npx prettier --write "$FILE" --log-level silent 2>/dev/null
exit 0
