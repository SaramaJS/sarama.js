const SourceLocation = require('../source-location');

class Node {
  constructor(start, locations, ranges) {
    this.locations = locations;
    this.ranges = ranges;
    this.type = null;
  }

  start() {
    var node = new Node();
    if (this.locations) {
      node.loc = new SourceLocation();
    }
    if (this.ranges) {
      node.range = [tokStart, 0];
    }
    return node;
  }

  // Finish an AST node, adding `type` and `end` properties.
  finish(node, type) {
    node.type = type;
    if (options.locations)
      node.loc.end = lastEndLoc;
    if (options.ranges)
      node.range[1] = lastEnd;
    return node;
  }

  // Start a node whose start offset information should be based on
  // the start of another node. For example, a binary operator node is
  // only started after its left-hand side has already been parsed.
  startFrom(other) {
    var node = new Node();
    if (options.locations) {
      node.loc = new SourceLocation();
      node.loc.start = other.loc.start;
    }
    if (options.ranges) {
      node.range = [other.range[0], 0];
    }
    return node;
  }
}

module.exports = Node;