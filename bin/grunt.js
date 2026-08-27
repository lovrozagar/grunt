#!/usr/bin/env node
import { start } from "../cli/grunt.mjs"

start().catch(() => {
  process.exit(1)
})
