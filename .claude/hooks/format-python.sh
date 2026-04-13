#!/bin/bash
# Python 파일 포매팅 훅 (PostToolUse)
# stdin으로 JSON 입력 수신

FILE=$(python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# ruff가 설치된 경우만 실행
command -v ruff >/dev/null 2>&1 || exit 0

ruff format "$FILE" --quiet 2>/dev/null
ruff check "$FILE" --fix --quiet 2>/dev/null
exit 0
