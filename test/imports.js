const acorn = require('acorn');
require('should');
const sarama = require('../loose');
const sanitizer = require('../util/sanitizer');

describe('Imports', () => {
  it('import as', () => {
    sanitizer(sarama.parse('import numpy as np\n')).should.deepEqual(sanitizer(acorn.parse('const np = require("numpy");')));
  });
});