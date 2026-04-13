#!/bin/bash
# 코드에 하드코딩된 시크릿 패턴 감지
# PostToolUse(Edit|Write)에서 실행

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Python, TypeScript 파일만 검사
if [[ "$FILE_PATH" != *.py ]] && [[ "$FILE_PATH" != *.ts ]] && [[ "$FILE_PATH" != *.tsx ]]; then
  exit 0
fi

# 위험 패턴: 실제 API 키처럼 보이는 문자열
DANGER_PATTERNS=(
  'sk-ant-[a-zA-Z0-9]'
  'ANTHROPIC_API_KEY\s*=\s*"[^$]'
  'api_key\s*=\s*"[a-zA-Z0-9]'
)

for pattern in "${DANGER_PATTERNS[@]}"; do
  if grep -qP "$pattern" "$FILE_PATH" 2>/dev/null; then
    echo "경고: '$FILE_PATH' 에 하드코딩된 API 키가 감지되었습니다. 환경변수를 사용하세요." >&2
    exit 2
  fi
done

exit 0
