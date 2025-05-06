# Cloji

A lightweight interpreter for a Lisp-like language inspired by Clojure.

It supports expressions for definitions, function declarations, control flow, object/array operations, destructuring, and more.

## 🚀 Getting Started

### Installation

```bash
npm install cloji
```

### Usage

CLI
```ts
cloji script.clj
```

As module
```ts
import { exec } from 'cloji'

const scope = exec('(def x 10) (+ x 5)')
console.log(scope.result) // 15
```

## 🧪 Features & Examples

### 📦 Variables

Def (ident, value) Define variable.
```clj
(def a 1)      ;; define a
```

Set (ident, value) Set variable value.
```clj
(set a 2)      ;; update a
```

It works inside fuction body. Variables are readable only inside the scope of the function where it was declared.
```clj
(defn f []
  (def a 1) a)
```

### 🔧 Functions
```clj
(def f (fn [x] x))
(f 5) ;; => 5

(defn square [x] (* x x))
(square 4) ;; => 16
```

Destructiring params
```clj
(defn f [p1 &rest] rest)
(f 3 4 5) ;; return [4 5]
```

### 💡 JavaScript Integration

```clj
(new Date) ;; create a new instance
```

"Date" is not available by default, it should be provided by using globals.
```ts
exec(`(new Date)`, { Date })
```

### 📝 Comments

Parser level
```clj
;; this is a comment
```

Parsed but not executed
```clj
(## this is a comment)
```

### 🖨️ Print

```clj
(print "Hello" "World")
;; Logs: Hello World
```

### 🔀 Conditionals

```clj
(if true 1 2) ;; => 1

(cond
  (= x 1) "eq"
  (> x 1) "gt"
  :else   "default")
```

### 🧱 Object Structuring

```clj
{:name "john" :age 20}
{:name "peter" &user} ;; spread `user` into the object
```

### 🔎 Object Destructuring

```clj
(def {name age} user)
(def {name &rest} user)
```

### 📚 Arrays

```clj
[1 2 3]
[1 2 &arr]
```

### 🧩 Array Destructuring

```clj
(def [head &tail] arr)
```

### 🛠 Utilities

Array (arrayLike, mapperFn). Works like JS [Array.from()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)
```clj
(array {:length 3} (fn [a i] i)) ;; => [0 1 2]
```

Aget (object, ...keys)
```clj
(aget {:name "john"} "name") ;; "john"
(aget {:name "john"} :name)  ;; "john"
(aget {:name "john" :pets ["cat" "dog"]} :pets 0)  ;; "cat"
```

Aset (object, ...keys, value)
```clj
(aset {:name "john"} :name "peter")
(aset {:name "john" :pets ["cat" "dog"]} :pets 0 "pig") ;; {:name "john" :pets ["pig" "dog"]}
```

### ➕ Operators

```clj
(+ 3 4) ;; => 7
(?? nil 5) ;; => 5
```

Available operators
```clj
+
-
*
/
=
not=
<
>
<=
>=
and
or
not
?? ;; coalesce
```

### 🧵 Threading

Like Clojure "->"
```clj
(thread [1 2 3]
  (map (fn [x] (* x 2)))
  (filter (fn [x] (> x 2))))
```

### 🚀 Doto

Like Clojure "doto"
```clj
(doto [1 2 3]
  (tail)
  (head)) ;; => 2
```

## 📄 License

MIT

## 🙌 Contributing

Feel free to open issues or submit PRs to extend the language, fix bugs, or improve performance.
