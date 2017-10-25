const acorn = require('acorn');
require('should');
const sarama = require('../loose');

describe('Maths', () => {
  it('simple add and multiply', () => {
    sarama.parse('(1 + 2 ) * 3').should.deepEqual(acorn.parse('(1 + 2 ) * 3'));
  });
  it('zero multiplied by zero', () => {
    sarama.parse('0x0').should.deepEqual(acorn.parse('0x0'));
  });
  it('zero e plus one hundred', () => {
    sarama.parse('0e+100').should.deepEqual(acorn.parse('0e+100'));
  });
});