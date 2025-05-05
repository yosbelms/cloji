import parse, { createNode, isNode, Node, NodeType } from './parser'

export const clojifn = (fn: any) => {
  if (fn.$clojifn === void 0) fn.$clojifn = true
  return fn
}

const hasOwnProperty = (obj: any, propName: string) =>
  Object.prototype.hasOwnProperty.call(obj, propName)

const guardProp = (propName: string) => {
  const forbiddenProps = ['prototype', 'constructor', '__proto__']
  if (forbiddenProps.includes(propName)) {
    throw new Error(`Forbidden property ${propName}`)
  }
}

const getNodeIdent = (node: Node) => {
  const value = node.value
  if (typeof value === 'string') {
    return value
  } else if (Array.isArray(value)) {
    let name: string | void = ''
    value.some((node: Node) => {
      name = getNodeIdent(node)
      return name
    })
    return name
  }
}

const error = (e: any, node: Node) => {
  if (!e.clojiStack) {
    e.clojiStack = []
  }
  if (node) {
    e.clojiStack.push(`${getNodeIdent(node)} (${node.line})`)
  }
  return e
}

class Scope {
  private vars: Record<string, any> = Object.create(null)
  private readOnlyVarNames: string[] = []
  private parent?: Scope
  result: any
  error: any

  constructor(vars: Record<string, any>, parent?: Scope) {
    Object.entries(vars).forEach(([key, value]) => {
      this.readOnlyVarNames.push(key)
      this.vars[key] = value
    })
    this.parent = parent
  }

  isDefined(varName: string): any {
    return (
      hasOwnProperty(this.vars, varName) ||
      (this.parent && this.parent.isDefined(varName))
    )
  }

  isReadOnlyVarName(varName: string) {
    return this.readOnlyVarNames.indexOf(varName) !== -1
  }

  getVar(varName: string): any {
    guardProp(varName)
    if (hasOwnProperty(this.vars, varName)) return this.vars[varName]
    if (this.parent) return this.parent.getVar(varName)
  }

  get(name: string) {
    let value: any
    const [varName, ...path] = name.split('.')
    if (!this.isDefined(varName)) {
      throw new Error(`${varName} is not defined`)
    }
    value = this.getVar(varName)
    if (path.length) {
      value = objectPathGet(value, path)
    }
    return value
  }

  set(name: string, value: any) {
    const [varName, ...path] = name.split('.')
    if (path.length) {
      objectPathSet(this.getVar(varName), path, value)
    } else {
      this.vars[varName] = value
    }
    return value
  }
}

const coreScope = new Scope({

  // (## ...)
  '##': clojifn(() => { }),

  // (def a 1)
  // (def [a b] [2 3])
  def: clojifn((scope: Scope, ident: Node, value: Node) => {
    if (scope.isReadOnlyVarName(ident.value)) {
      throw new Error(`Trying to set readonly variable '${ident.value}'`)
    }
    const set = scope.get('set')
    return set(scope, ident, value)
  }),

  // (set a 2)
  // (set [a b] [2 3])
  set: clojifn((scope: Scope, ident: Node, value: Node) => {
    const evaledValue = evalExpr(scope, value)
    if (ident.type == NodeType.Array) {
      destructArray(scope, ident.value, evaledValue)
    } else if (ident.type == NodeType.Object) {
      destructObject(scope, ident.value, evaledValue)
    } else {
      return scope.set(ident.value, evaledValue)
    }
  }),

  // (fn [a] a)
  fn: clojifn((decScope: Scope, argNamesArray: Node, ...body: any[]) => {
    const fn = clojifn((execScope: Scope, ...args: any[]) => {
      const evaledArgs = evalList(execScope, args)
      const fnScope = new Scope({}, decScope)
      destructArray(fnScope, argNamesArray.value, evaledArgs)
      return executeBlock(fnScope, body)
    })

    return fn
  }),

  // (defn [a] a)
  defn: clojifn((scope: Scope, ident: Node, args: Node[], ...body: Node[]) => {
    const _func = scope.get('fn')
    return scope.set(ident.value, _func(scope, args, ...body))
  }),

  // (jsfn func)
  // (jsfn [arg1 arg2] expr)
  jsfn: clojifn((scope: Scope, args: Node, ...body: any[]) => {
    let func: any
    if (args === void 0) {
      return void 0
    } else if (args?.type === 'array') {
      const _func = scope.get('fn')
      func = _func(scope, args, ...body)
    } else {
      func = evalExpr(scope, args)
      if (!func?.$clojifn) {
        throw new Error(`unexpected ${args?.type}`)
      }
    }

    return (...args: any[]) => {
      const jsArgs = args.map((arg) => createNode({ type: NodeType.Js, value: arg }))
      const result = func(scope, ...jsArgs)
      return result
    }
  }),

  // (print 'ok' 'msg')
  print: clojifn((scope: Scope, ...args: any[]) => {
    return console.log(...evalList(scope, args))
  }),

  // (if cond 'ok' 'notok')
  if: clojifn((scope: Scope, cond: any, thn: any, els: any) => {
    return evalExpr(scope, cond) ? evalExpr(scope, thn) : evalExpr(scope, els)
  }),

  // (cond (= x 1) 'eq' (> x 1) 'gt' :else 'default')
  cond: clojifn((scope: Scope, ...args: any[]) => {
    const array = structArray(scope, args)
    const object = structObject(scope, args)
    for (let i = 0; i < array.length; i += 2) {
      const cond = array[i]
      const thn = array[i + 1]
      if (cond) return thn
    }
    return object.else
  }),

  // (object :name 'john' :age 20)
  object: clojifn((scope: Scope, ...items: Node[]) => {
    return structObject(scope, items)
  }),

  // (array {:length 4})
  // (array [] (fn [x] x))
  // JS: Array.from()
  array: clojifn((scope: Scope, arrayLike: Node, mapFn: Node) => {
    const jsfn = scope.get('jsfn')
    const fn = jsfn(scope, mapFn)
    const arg = evalExpr(scope, arrayLike)
    return Array.from(arg, fn)
  }),

  // (new Date)
  new: clojifn((scope: Scope, cls: any, ...args: any[]) => {
    const Class = evalExpr(scope, cls)
    const evaledArgs = evalList(scope, args)
    return new Class(...evaledArgs)
  }),

  // (aget obj key1 key2)
  aget: clojifn((scope: Scope, obj: Node, ...path: any[]) => {
    return objectPathGet(
      evalExpr(scope, obj),
      evalList(scope, keysToString(path))
    )
  }),

  // (aset obj key1 key2 value)
  aset: clojifn((scope: Scope, obj: Node, ...rest: any[]) => {
    const val = rest[rest.length - 1]
    const path = rest.slice(0, rest.length - 1)
    const target = evalExpr(scope, obj)
    const val_ = evalExpr(scope, val)
    const path_ = evalList(scope, keysToString(path))

    objectPathSet(target, path_, val_)
    return target
  }),

  // (thread promise (then (fn [])) (catch (fn [])))
  thread: clojifn((scope: Scope, obj: Node, ...exprs: Node[]) => {
    let ret = evalExpr(scope, obj)
    exprs.forEach((expr) => {
      const [methodName, ...args] = expr.value
      const member = ret[methodName.value]
      if (typeof member !== 'function') {
        throw error(
          new Error(`${methodName.value} is not a function`),
          methodName
        )
      }
      const evaledArgs = evalList(scope, args)
      ret = member.apply(ret, evaledArgs)
    })
    return ret
  }),

  //(doto arr (tail) (head))
  doto: clojifn((scope: Scope, obj: Node, ...exprs: Node[]) => {
    let ret = evalExpr(scope, obj)
    exprs.forEach((expr) => {
      expr.value.splice(1, 0, createNode({ type: NodeType.Js, value: ret }))
      const fnNode = expr.value[0]
      if (typeof scope.get(fnNode.value) !== 'function') {
        throw error(
          new Error(`${fnNode.value} is not a function`),
          fnNode
        )
      }
      ret = evalExpr(scope, expr)
    })
    return ret
  }),

  // (op a b c)
  '+': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a + b)
  }),
  '-': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a - b)
  }),
  '*': (scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a * b)
  },
  '/': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a / b)
  }),
  '=': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a === b)
  }),
  'not=': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a !== b)
  }),
  '<': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a < b)
  }),
  '>': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a > b)
  }),
  '<=': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a <= b)
  }),
  '>=': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a >= b)
  }),
  and: clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a && b)
  }),
  or: clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a || b)
  }),
  '??': clojifn((scope: Scope, ...items: any[]) => {
    return applyBinaryOp(scope, items, (a: any, b: any) => a ?? b)
  }),
  not: clojifn((scope: Scope, a: any) => {
    return !evalExpr(scope, a)
  }),
})

const structObject = (scope: Scope, items: Node[]): Record<string, any> => {
  const object = Object.create(null)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    switch (item.type) {
      case NodeType.Rest:
        const restValue = scope.get(item.value)
        if (typeof restValue === 'object') Object.assign(object, restValue)
        break
      case NodeType.Key:
        const key = item.value
        const nextItem = items[i + 1]
        if (isNode(nextItem)) {
          switch (nextItem.type) {
            case NodeType.Key:
            case NodeType.Rest:
              object[key] = void 0
              continue
            default:
              object[key] = evalExpr(scope, nextItem)
              i++
          }
        } else {
          object[key] = nextItem
        }
    }
  }

  return object
}

const structArray = (scope: Scope, items: Node[]): any[] => {
  let array: any[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type == NodeType.Rest) {
      const rest = scope.get(item.value)
      if (!(rest && typeof rest[Symbol.iterator] === 'function')) {
        throw new Error(`${item.value} is not iterable`)
      }
      if (Array.isArray(rest)) array = array.concat(rest)
    } else {
      array.push(evalExpr(scope, item))
    }
  }
  return array
}

const destructObject = (scope: Scope, items: Node[], object: any) => {
  const selectedKeys = Object.create(null)
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    switch (item.type) {
      case NodeType.Ident:
        const name = item.value
        selectedKeys[name] = true
        scope.set(name, object[name])
        break
      case NodeType.Rest:
        const rest = Object.create(null)
        Object.keys(object).forEach((key) => {
          if (!selectedKeys[key]) rest[key] = object[key]
        })
        scope.set(item.value, rest)
        return
    }
  }
}

const destructArray = (scope: Scope, items: Node[], array: any[]) => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    switch (item.type) {
      case NodeType.Ident:
        scope.set(item.value, array[i])
        break
      case NodeType.Rest:
        scope.set(item.value, array.slice(i))
        return
    }
  }
}

const evalList = (scope: Scope, nodes: Node[]): any[] => {
  return nodes.map((node) => evalExpr(scope, node))
}

const keysToString = (nodes: Node[]) => {
  return nodes.map((node) =>
    node.type === NodeType.Key ? createNode({ ...node, type: NodeType.String }) : node
  )
}

const evalExpr = (scope: Scope, node: Node) => {
  if (!node) return
  if (!isNode(node)) {
    throw new Error(`Invalid node ${JSON.stringify(node)}`)
  }

  const value = node.value
  switch (node.type) {
    case 'js':
      return value
    case 'string':
      return String(value)
    case 'number':
      return Number(value)
    case 'key':
      return node
    case 'array':
      return structArray(scope, node.value)
    case 'object':
      return structObject(scope, node.value)
    case 'keyword':
      switch (value) {
        case 'true':
          return true
        case 'false':
          return false
        case 'nil':
          return null
        case 'void':
          return void 0
      }
    case 'rest':
      return node
    case 'identifier':
      return scope.get(node.value)
    case 'sexpression':
      const [ident, ...args] = value

      let func: Function = scope.get(ident.value)
      if (typeof func !== 'function') {
        throw new Error(`${ident.value} is not a function`)
      }

      try {
        if ((func as any).$clojifn) {
          // lang defined
          return func(scope, ...args)
        } else {
          // js defined
          const evaledArgs = evalList(scope, args)
          return func(...evaledArgs)
        }
      } catch (err: any) {
        throw error(err, node)
      }
  }

  throw new Error(`Invalid syntax ${node.value}`)
}

const objectPathGet = (obj: any, path: string[]) => {
  let current = obj
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    guardProp(key)
    const value = current[key]
    if (typeof value === 'function') {
      current = value.$clojifn ? clojifn(value.bind(current)) : value.bind(current)
    } else {
      current = value
    }
  }
  return current
}

const objectPathSet = (obj: any, path: string[], value: any) => {
  let current = obj
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    guardProp(key)
    if (current !== void 0 && i == path.length - 1) {
      current[key] = value
      return true
    }
    current = current[key]
  }
  return false
}

const applyBinaryOp = (scope: any, items: Node[], op: Function) => {
  const [first, ...rest] = items
  return rest.reduce(
    (acc, item) => op(acc, evalExpr(scope, item)),
    evalExpr(scope, first)
  )
}

const executeBlock = (scope: Scope, program: any[]) => {
  let result: any
  for (let i = 0; i < program.length; i++) {
    const node = program[i]
    result = evalExpr(scope, node)
  }
  return result
}

class Script {
  private scope: Scope
  private throwOnErr: boolean

  constructor(scope: Scope, throwOnErr: boolean = true) {
    this.scope = scope
    this.throwOnErr = throwOnErr
  }

  exec(source: string) {
    const program = parse(source)
    try {
      this.scope.result = executeBlock(this.scope, program.value)
    } catch (err: any) {
      if (err.clojiStack) {
        err.message = `${err.message} \n at ${err.clojiStack.join('\n at ')} \n\n -----`
        this.scope.error = err
        if (this.throwOnErr) throw err
      }
    }
    return this.scope
  }
}

export const script = (globals: Record<string, any> = {}, throwOnErr?: boolean): Script => {
  const scope = new Scope(globals, coreScope)
  return new Script(scope, throwOnErr)
}

export const exec = (source: string, globals: Record<string, any> = {}, throwOnErr?: boolean): Scope => {
  const scr = script(globals, throwOnErr)
  return scr.exec(source)
}
