# Cloji

A lightweight interpreter for a Lisp-like language implemented in TypeScript. It supports expressions for definitions, function declarations, control flow, object/array operations, destructuring, and more.

## 🚀 Getting Started

### Installation

```bash
npm install cloji
````

### Usage

```ts
import { exec } from 'cloji'

const scope = exec('(def x 10) (+ x 5)')
console.log(scope.result) // 15
```

---

## 🧪 Features & Examples

### 📦 Variables

```lisp
(def a 1)      ;; define a
(set a 2)      ;; update a
```

### 🔧 Functions

```lisp
(def f (fn [x] x))
(f 5) ;; => 5

(defn square [x] (* x x))
(square 4) ;; => 16
```

### 💡 JavaScript Integration

```lisp
(jsfn [x] x) ;; returns a native JS function
```

### 📝 Comments

Parser lever
```lisp
;; this is a comment
```

Parsed but not executed
```lisp
(## this is a comment)
```

### 🖨️ Print

```lisp
(print "Hello" "World")
;; Logs: Hello World
```

### 🔀 Conditionals

```lisp
(if true 1 2) ;; => 1

(cond
  (= x 1) "eq"
  (> x 1) "gt"
  :else   "default")
```

### 🧱 Object Structuring

```lisp
{:name "john" :age 20}
{:name "peter" &user} ;; spread `user` into the object
```

### 🔎 Object Destructuring

```lisp
(def {name age} user)
(def {name &rest} user)
```

### 📚 Arrays

```lisp
[1 2 3]
[1 2 &arr]
```

### 🧩 Array Destructuring

```lisp
(def [head &tail] arr)
```

### 🛠 Utilities

```lisp
(object :name "john")
(array {:length 3} (fn [a i] i)) ;; => [0 1 2]
(aget {:name "john"} "name")
(aset {:name "john"} "name" "peter")
```

### ➕ Operators

```lisp
(+ 3 4) ;; => 7
(?? nil 5) ;; => 5
```

### 🧵 Threading Macro

```lisp
(thread [1 2 3]
  (map (jsfn [x] (* x 2)))
  (filter (jsfn [x] (> x 2))))
```

### 🚀 Doto

```lisp
(doto [1 2 3]
  (tail)
  (head)) ;; => 2
```

---

## 📄 License

MIT

---

## 🙌 Contributing

Feel free to open issues or submit PRs to extend the language, fix bugs, or improve performance.

```

---

Let me know if you'd like this README tailored for publishing on npm, or if you're deploying it as a CLI or REPL.
```
