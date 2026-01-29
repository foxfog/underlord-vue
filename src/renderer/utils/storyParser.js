// Simple parser for a minimal Ink-like format used in `public/data/story/*/*.ink`
export async function loadStory(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load story: ' + url)
  const text = await res.text()
  return parseInk(text)
}

function parseInk(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const labels = {}
  let currentLabel = '_start'
  let i = 0

  const indentLevel = (s) => s.match(/^\s*/)[0].length

  while (i < lines.length) {
    let raw = lines[i]
    const line = raw.trim()
    if (line === '' ) { i++; continue }

    if (line.startsWith('label ')) {
      currentLabel = line.slice(6).trim().replace(/:$/, '')
      labels[currentLabel] = []
      i++;
      continue
    }

    if (!labels[currentLabel]) labels[currentLabel] = []

    if (line.startsWith('scene ')) {
      labels[currentLabel].push({type:'scene', value: line.slice(6).trim()})
      i++; continue
    }

    if (line.startsWith('show ')) {
      labels[currentLabel].push({type:'show', value: line.slice(5).trim()})
      i++; continue
    }

    if (line.startsWith('hide ')) {
      labels[currentLabel].push({type:'hide', value: line.slice(5).trim()})
      i++; continue
    }

    if (line === 'menu:' || line.startsWith('menu:')) {
      // parse menu block
      const baseIndent = indentLevel(raw)
      i++
      const menu = {type:'menu', description: null, choices: []}
      while (i < lines.length && lines[i].trim() === '') { i++ }
      // optional description lines (character or narrator) until a quoted choice
      while (i < lines.length) {
        const l = lines[i]
        const t = l.trim()
        if (t.startsWith('"')) break
        if (t === '') { i++; continue }
        // take as description line
        if (t.includes('"')) {
          // e.g. albedo "text"
          menu.description = t
          i++; break
        } else {
          menu.description = t
          i++; continue
        }
      }
      // parse choices
      while (i < lines.length) {
        const l = lines[i]
        if (l.trim() === '') { i++; continue }
        const ind = indentLevel(l)
        if (ind <= baseIndent) break
        const t = l.trim()
        if (!t.startsWith('"')) break
        const closing = t.lastIndexOf('"')
        const choiceText = t.slice(1, closing)
        // parse block for this choice
        i++
        const block = []
        while (i < lines.length) {
          if (lines[i].trim() === '') { i++; continue }
          const ind2 = indentLevel(lines[i])
          if (ind2 <= ind) break
          block.push(lines[i].trim())
          i++
        }
        menu.choices.push({text: choiceText, block})
      }
      labels[currentLabel].push(menu)
      continue
    }

    if (line.startsWith('->')) {
      const dest = line.slice(2).trim()
      if (dest === 'END') labels[currentLabel].push({type:'end'})
      else labels[currentLabel].push({type:'goto', value: dest})
      i++; continue
    }

    // character line or narrator
    const charMatch = line.match(/^([A-Za-z0-9_]+)\s+"([\s\S]+)"$/)
    if (charMatch) {
      labels[currentLabel].push({type:'char', name: charMatch[1], text: charMatch[2]})
      i++; continue
    }

    const narratorMatch = line.match(/^"([\s\S]+)"$/)
    if (narratorMatch) {
      labels[currentLabel].push({type:'text', text: narratorMatch[1]})
      i++; continue
    }

    // fallback: skip
    i++
  }

  return labels
}

export function debugParse(s) { return parseInk(s) }
