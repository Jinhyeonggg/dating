import type { WorldContextRow, WorldSnippet } from './types'

export function buildWorldSnippet(items: WorldContextRow[]): WorldSnippet {
  if (items.length === 0) return { items: [], promptText: '' }

  const lines = items.map((item) => `- (${item.category}) ${item.headline}`)

  const promptText = `[오늘 대략 이런 것들이 화제야 — 자연스럽게 언급해도 되고 안 해도 돼:]
${lines.join('\n')}

[어색하게 뉴스 브리핑하지 말 것. 대화 흐름에 자연스러우면 섞고, 아니면 무시.]`

  return { items, promptText }
}
