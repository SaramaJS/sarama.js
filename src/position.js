// These are used when `options.locations` is on, for the
// `tokStartLoc` and `tokEndLoc` properties.

class Position {
  constructor(tokCurLine, tokPos, tokLineStart) {
    this.line = tokCurLine;
    this.column = tokPos - tokLineStart;
  }
}

module.exports = Position;