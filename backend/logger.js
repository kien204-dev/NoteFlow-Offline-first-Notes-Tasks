export const logger = {
  info: (...args) => {
    process.stdout.write(`${args.join(' ')}\n`)
  },
  warn: (...args) => {
    process.stderr.write(`${args.join(' ')}\n`)
  },
  error: (error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error)
    process.stderr.write(`${message}\n`)
  },
}
