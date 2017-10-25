const acorn = require('acorn');
require('should');
const sarama = require('../loose');

describe('Objects', () => {
  it('this', () => {
    sarama.parse('this\n').should.deepEqual(acorn.parse('this;\n'));
  });
});