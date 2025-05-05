#!/usr/bin/env node

const fs = require('node:fs')
const { exec } = require('../src/index')

const argv = process.argv[process.argv.length - 1].trim()
let src = ''
try {
  src = fs.readFileSync(argv, 'utf8')
} catch (err) {
  console.error('Error reading file:', err)
}

exec(src)
