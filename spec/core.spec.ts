import 'jasmine'
import { exec } from '../src'

describe('Core Scope', () => {

  it('##', () => {
    expect(exec('(## some comment)').result).toBe(void 0)
  })

  it('def', () => {
    const scope = exec('(def a 1)')
    expect(scope.result).toBe(1)
    expect(scope.getVar('a')).toBe(1)
  })

  it('set', () => {
    let scope = exec('(def a 1) (set a 2)')
    expect(scope.getVar('a')).toBe(2)

    scope = exec('(def a {:name "John"}) (set a.name "Peter")')
    expect(scope.getVar('a').name).toBe('Peter')
  })

  it('fn', () => {
    let scope = exec('(def f (fn []))')
    expect(typeof scope.getVar('f')).toBe('function')

    scope = exec('(def f (fn [x] x)) (f 5)')
    expect(scope.result).toBe(5)
  })

  it('defn', () => {
    let scope = exec('(defn f [])')
    expect(typeof scope.getVar('f')).toBe('function')

    scope = exec('(defn f [x] x) (f 5)')
    expect(scope.result).toBe(5)
  })

  describe('print', () => {
    const originalLog = console.log
    let out: string[] = []

    beforeAll(() => {
      console.log = (...args) => {
        out = [...out, ...args]
      }
    })

    beforeEach(() => {
      out = []
    })

    it('prints to console', () => {
      exec('(print "a" "b")')
      expect(out).toEqual(['a', 'b'])
    })

    afterAll(() => {
      console.log = originalLog
    })
  })

  it('if', () => {
    let scope = exec('(if true 2 4)')
    expect(scope.result).toBe(2)

    scope = exec('(if false 2 4)')
    expect(scope.result).toBe(4)
  })

  it('cond', () => {
    const src = '(cond (= x 1) "eq" (> x 1) "gt" :else "default")'
    expect(exec(src, { x: 1 }).result).toBe('eq')
    expect(exec(src, { x: 2 }).result).toBe('gt')
    expect(exec(src, { x: 0 }).result).toBe('default')
  })

  it('object', () => {
    const scope = exec('(object :name "john" :age 20)')
    expect(scope.result).toEqual({ name: 'john', age: 20 })
  })

  it('array', () => {
    let scope = exec('(array {:length 4})')
    expect(scope.result.length).toBe(4)

    scope = exec('(array {:length 4} (fn [a idx] idx))')
    expect(scope.result).toEqual([0, 1, 2, 3])
  })

  it('new', () => {
    const scope = exec('(new Date)', { Date })
    expect(scope.result.getFullYear()).toBe((new Date).getFullYear())
  })

  it('aget', () => {
    let scope = exec('(aget {:name "john"} "name")')
    expect(scope.result).toBe('john')

    scope = exec('(aget {:name "john"} :name)')
    expect(scope.result).toBe('john')

    scope = exec('(aget {:name "john"} key)', { key: 'name' })
    expect(scope.result).toBe('john')
  })

  it('aset', () => {
    let scope = exec('(aset {:name "john"} "name" "peter")')
    expect(scope.result).toEqual({ name: 'peter' })

    scope = exec('(aset {:name "john" :pets ["cat" "dog"]} :pets 0 "dog")')
    expect(scope.result).toEqual({ name: 'john', pets: ['dog', 'dog'] })
  })

  it('thread', () => {
    const scope = exec(`
      (thread [3 4 5]
        (filter (fn [x] (< x 5)))
        (map (fn [x] (+ x 3))))
    `)
    expect(scope.result).toEqual([6, 7])
  })

  it('doto', () => {
    const head = (arr: any[]) => arr[0]
    const tail = (arr: any[]) => arr.slice(1)

    const scope = exec(`
      (doto [3 4 5]
        (tail)
        (head))
    `, { head, tail })

    expect(scope.result).toBe(4)
  })

  it('+ operator', () => {
    const scope = exec('(+ 3 4)')
    expect(scope.result).toBe(7)
  })

  it('?? operator', () => {
    let scope = exec('(?? nil 5)')
    expect(scope.result).toBe(5)

    scope = exec('(?? 5 void)')
    expect(scope.result).toBe(5)

    scope = exec('(?? nil void 5)')
    expect(scope.result).toBe(5)
  })
})
