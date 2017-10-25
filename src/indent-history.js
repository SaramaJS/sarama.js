class IndentHistory {
  constructor() {
    this.indent = [];
    this.dedentCount = 0;
  }

  count() { return this.indent.length; }

  len(i) {
    if (typeof i === 'undefined' || i >= this.indent.length) i = this.indent.length - 1;
    return this.indent[i].length;
  }

  isIndent(s) {
    return this.indent.length === 0 || s.length > this.len();
  }

  isDedent(s) {
    return this.indent.length > 0 && s.length < this.len();
  }

  addIndent(s) { this.indent.push(s); }

  addDedent(s) {
    this.dedentCount = 0;
    for (let i = this.indent.length - 1; i >= 0 && s.length < this.indent[i].length; --i) {
      ++this.dedentCount;
    }
  }

  updateDedent() { this.dedentCount = this.count(); }

  pop() {
    --this.dedentCount;
    this.indent.pop();
  }

  undoIndent() { this.pop(); }
}

module.exports = IndentHistory;