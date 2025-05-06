type Data = {
  position: number
  stream: string
  startLine: number
  currentLine: number
  stack: string[]
}

export const NodeType = {
  Root: 'root',
  Sexpr: 'sexpression',
  String: 'string',
  Number: 'number',
  Key: 'key',
  Ident: 'identifier',
  Keyword: 'keyword',
  Array: 'array',
  Object: 'object',
  Rest: 'rest',
  Js: 'js',
} as const

type NodeTypeKey = keyof typeof NodeType
type NodeTypeValue = typeof NodeType[NodeTypeKey]
type NodeValue = any

export const nodeKey = Symbol.for('node')
export const createNode = (node: Partial<Node>): Node => {
  return { ...node, [nodeKey]: true } as Node
}

export const isNode = (node: any) => {
  return node && node[nodeKey]
}

export type Node = {
  [key in typeof nodeKey]: true
} & {
  type: NodeTypeValue
  value: NodeValue
  line: number
}

const stringRegex = /^("([^\\"]|\\[\s\S])*")/
const keyRegex = /^\:\w+/
const numberRegex = /^0x[\da-fA-F]+|^\d*\.?\d+(?:[eE][+-]?\d+)?/
const keywordRegex = /^(true|false|nil|void)\b/
const identRegex = /^[\d\w\.\+\-\*\/\=\<\>\"\'\$\#\?]+/
const restRegex = /^\&[\d\w\.\+\-\*\/\=\<\>\"\'\$\#\?]+/

export default (stream: string) => {
  const data: Data = {
    position: 0,
    stream,
    startLine: 1,
    currentLine: 1,
    stack: [],
  }
  const node = parse(data)

  if (data.stack.length > 0) {
    throw new Error(`Unmatched opening bracket '${data.stack.pop()}' at line ${data.currentLine}`)
  }

  return node
}

const skipWhitespace = (data: Data) => {
  const whitespaceRegex = /^[\s\n]+/
  match(data, whitespaceRegex, true)
}

const match = (data: Data, pattern: RegExp, consume: boolean) => {
  pattern.lastIndex = 0
  const rest = data.stream.slice(data.position)
  const result = pattern.exec(rest)
  if (!result) return null

  if (consume) {
    data.startLine = data.currentLine
    data.position += result[0].length
    data.currentLine += (result[0].match(/\n/g) || []).length
  }

  return result[0]
}

const isEnd = (data: Data) => {
  return data.position >= data.stream.length
}

const parse = (data: Data) => {
  let txt: string | null = ''
  let isComment: boolean = false
  const node: Node = createNode({ type: NodeType.Root, value: [], line: 0 })

  while (!isEnd(data)) {
    skipWhitespace(data)

    if (isComment) {
      if (match(data, /^\n/, true)) {
        isComment = false
      } else {
        data.position++
      }
    } else if (match(data, /^;;/, true)) {
      isComment = true
    } else if (match(data, /^\)/, true)) {
      if (data.stack.pop() !== '(') {
        throw new Error(`Unexpected closing parenthesis at line ${data.currentLine}`)
      }
      break
    } else if (match(data, /^\(/, true)) {
      data.stack.push('(')
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data),
        type: NodeType.Sexpr,
        line
      }))
    } else if (match(data, /^\]/, true)) {
      if (data.stack.pop() !== '[') {
        throw new Error(`Unexpected closing bracket at line ${data.currentLine}`)
      }
      break
    } else if (match(data, /^\[/, true)) {
      data.stack.push('[')
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data),
        type: NodeType.Array,
        line
      }))
    } else if (match(data, /^\}/, true)) {
      if (data.stack.pop() !== '{') {
        throw new Error(`Unexpected closing brace at line ${data.currentLine}`)
      }
      break
    } else if (match(data, /^\{/, true)) {
      data.stack.push('{')
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data),
        type: NodeType.Object,
        line
      }))
    } else if (txt = match(data, stringRegex, true)) {
      node.value.push(createNode({
        type: NodeType.String,
        value: txt.trim().slice(1, -1),
        line: data.startLine
      }))
    } else if (txt = match(data, keywordRegex, true)) {
      node.value.push(createNode({
        type: NodeType.Keyword,
        value: txt.trim(),
        line: data.startLine
      }))
    } else if (txt = match(data, keyRegex, true)) {
      node.value.push(createNode({
        type: NodeType.Key,
        value: txt.trim().slice(1),
        line: data.startLine
      }))
    } else if (txt = match(data, numberRegex, true)) {
      node.value.push(createNode({
        type: NodeType.Number,
        value: txt.trim(),
        line: data.startLine
      }))
    } else if (txt = match(data, restRegex, true)) {
      node.value.push(createNode({
        type: NodeType.Rest,
        value: txt.trim().slice(1),
        line: data.startLine
      }))
    } else if (txt = match(data, identRegex, true)) {
      node.value.push(createNode({
        type: NodeType.Ident,
        value: txt.trim(),
        line: data.startLine
      }))
    } else {
      const char = data.stream[data.position - 1]
      throw new Error(`Unrecognized token at line ${data.currentLine}: "${char}", code "${char.charCodeAt(0)}"`)
    }

    skipWhitespace(data)
  }

  node.line = data.currentLine
  return node
}
