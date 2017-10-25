const acorn = require('acorn');
require('should');
const sarama = require('../index');

describe('Imports', () => {
  it('import as', () => {
    sarama.parse('import numpy as np\n').should.deepEqual(acorn.parse('const numpy = require("np");'));
  });
});