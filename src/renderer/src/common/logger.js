/**
 * Prefixed logger class.
 */

export class Logger {
  /**
   * Logger
   * @param {object} [options]
   * @param {string} [options.prefix]
   * @param {string} [options.bg]
   * @param {string} [options.text]
   */
  constructor (options = {}) {
    const { prefix = 'pref', bg = 'black', text = 'white' } = options
    const _decor = [ `%c ${ prefix } `, `background: ${ bg }; color:${ text }; border-radius: 3px;` ]

    // bind overridden methods the console to show where it was called, not on this logger itself.
    this.log = (function () { return Function.prototype.bind.call(console.log, console, ..._decor) })()
    this.info = (function () { return Function.prototype.bind.call(console.info, console, ..._decor) })()
    this.warn = (function () { return Function.prototype.bind.call(console.warn, console, ..._decor) })()
    this.error = (function () { return Function.prototype.bind.call(console.error, console, ..._decor) })()
  }
}

export const dev = new Logger({ prefix: 'dev' })
