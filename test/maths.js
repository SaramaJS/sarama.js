const acorn = require('acorn');
require('should');
const sarama = require('../loose');
const sanitizer = require('../util/sanitizer');

describe('Maths', () => {
  it('simple add and multiply', () => {
    sanitizer(sarama.parse('(1 + 2 ) * 3')).should.deepEqual(sanitizer(acorn.parse('(1 + 2 ) * 3')));
  });
  it('zero multiplied by zero', () => {
    sanitizer(sarama.parse('0x0')).should.deepEqual(sanitizer(acorn.parse('0x0')));
  });
  it('zero e plus one hundred', () => {
    sanitizer(sarama.parse('0e+100')).should.deepEqual(sanitizer(acorn.parse('0e+100')));
  });
});