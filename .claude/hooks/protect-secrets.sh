#!/bin/bash
# 민감한 파일 보호 훅
# PreToolUse(Edit|Write)에서 실행

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROTECTED_PATTERNS=(".env" ".env.local" ".env.production" "id_rsa" "id_ed25519" ".pem" ".key")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern" ]]; then
    echo "차단: '$FILE_PATH'는 보호된 파일입니다. 환경변수/시크릿 파일은 직접 편집하세요." >&2
    exit 2
  fi
done

exit 0
