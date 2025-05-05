type Data = {
  position: number
  stream: string
  startLine: number
  currentLine: number
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
  name: string
}

const stringRegex = /^("([^\\"]|\\[\s\S])*")/
const keyRegex = /^\:\w+/
const numberRegex = /^0x[\da-fA-F]+|^\d*\.?\d+(?:[eE][+-]?\d+)?/
const keywordRegex = /^true|^false|^nil|^void/
const identRegex = /^[\d\w\.\+\-\*\/\=\<\>\"\'\$\#\?]+/
const restRegex = /^\&[\d\w\.\+\-\*\/\=\<\>\"\'\$\#\?]+/

export default (stream: string, fileName: string = '') => {
  var data = {
    position: 0,
    stream,
    fileName,
    startLine: 1,
    currentLine: 1,
  }
  return parse(data)
}

const match = (data: Data, pattern: RegExp, consume: boolean) => {
  const { stream, position, currentLine } = data
  const restOfStream = stream.substring(position)
  const match = restOfStream.match(pattern)
  if (!match || !match.length) {
    return null
  }
  if (consume) {
    data.startLine = currentLine
    data.position += match[0].length
    data.currentLine += match[0].match(/\n/g)?.length ?? 0
  }
  return match[0]
}

const isEnd = (data: Data) => {
  return data.position >= data.stream.length
}

const parse = (data: Data, type: NodeTypeValue = NodeType.Root) => {
  let txt: string | null = ''
  let isComment: boolean = false
  const node: Node = createNode({ type, value: [], line: 0, name: '' })

  while (!isEnd(data)) {
    if (isComment) {
      if (match(data, /^\n/, true)) {
        isComment = false
      } else {
        data.position++
      }
    } else if (match(data, /^;;/, true)) {
      isComment = true
    } else if (match(data, /^\)/, true)) {
      break
    } else if (match(data, /^\(/, true)) {
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data, NodeType.Sexpr),
        line
      }))
    } else if (match(data, /^\]/, true)) {
      break
    } else if (match(data, /^\[/, true)) {
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data, NodeType.Array),
        line
      }))
    } else if (match(data, /^\}/, true)) {
      break
    } else if (match(data, /^\{/, true)) {
      const line = data.startLine
      node.value.push(createNode({
        ...parse(data, NodeType.Object),
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
    } else if (match(data, /^\n/, false)) {
      data.currentLine++
      data.position++
    } else {
      data.position++
    }
  }

  node.line = data.currentLine
  return node
}
