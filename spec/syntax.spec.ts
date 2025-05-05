import 'jasmine'
import { exec } from '../src'

describe('Syntax', () => {

  describe('object struct', () => {
    it('handles basic object literals', () => {
      expect(exec('{}').result).toEqual({})
      expect(exec('{:age 10}').result).toEqual({ age: 10 })
      expect(exec('{:undef :age 10}').result).toEqual({ age: 10, undef: void 0 })
      expect(exec('{:age 10 :undef}').result).toEqual({ age: 10, undef: void 0 })
    })

    it('handles rest/spread merging', () => {
      const obj = { name: 'john' }
      expect(exec('{&obj}', { obj }).result).toEqual(obj)
      expect(exec('{:age 10 &obj}', { obj }).result).toEqual({ age: 10, ...obj })
      expect(exec('{&obj :age 10}', { obj }).result).toEqual({ age: 10, ...obj })
      expect(exec('{&obj :name "peter"}', { obj }).result).toEqual({ name: 'peter' }) // `:name` overrides `obj.name`
      expect(exec('{:name "peter" &obj}', { obj }).result).toEqual({ name: 'john' }) // `obj.name` overrides `:name`
    })
  })

  describe('object destructuring', () => {
    const obj = { name: 'john', age: 10 }

    it('binds single key', () => {
      expect(exec('(def {name} obj)', { obj }).get('name')).toBe('john')
    })

    it('binds multiple keys', () => {
      expect(exec('(def {name age} obj)', { obj }).get('age')).toBe(10)
    })

    it('captures rest of object', () => {
      expect(exec('(def {name &rest} obj)', { obj }).get('rest')).toEqual({ age: 10 })
    })
  })

  describe('array struct', () => {
    it('handles basic arrays', () => {
      expect(exec('[]').result).toEqual([])
      expect(exec('[3 5]').result).toEqual([3, 5])
    })

    it('handles rest/spread arrays', () => {
      const arr = [7, 8]
      expect(exec('[&arr]', { arr }).result).toEqual(arr)
      expect(exec('[3 4 &arr]', { arr }).result).toEqual([3, 4, ...arr])
      expect(exec('[&arr 3 4 &arr]', { arr }).result).toEqual([...arr, 3, 4, ...arr])
    })
  })

  describe('array destructuring', () => {
    const arr = [7, 8]

    it('binds first element', () => {
      expect(exec('(def [head] arr)', { arr }).get('head')).toBe(7)
    })

    it('binds head and rest', () => {
      expect(exec('(def [head &tail] arr)', { arr }).get('tail')).toEqual([8])
    })

    it('binds entire array', () => {
      expect(exec('(def [&all] arr)', { arr }).get('all')).toEqual([7, 8])
    })
  })
})
