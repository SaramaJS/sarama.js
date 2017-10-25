const acorn = require('acorn');
require('should');
const sarama = require('../loose');

describe('Numbers', () => {
  it('zero', () => {
    sarama.parse('0').should.deepEqual(acorn.parse('0'));
  });
  it('one', () => {
    sarama.parse('1').should.deepEqual(acorn.parse('1'));
  });
  it('two', () => {
    sarama.parse('2').should.deepEqual(acorn.parse('2'));
  });
  it('three', () => {
    sarama.parse('3').should.deepEqual(acorn.parse('3'));
  });
  it('four', () => {
    sarama.parse('4').should.deepEqual(acorn.parse('4'));
  });
  it('five', () => {
    sarama.parse('5').should.deepEqual(acorn.parse('5'));
  });
  it('six', () => {
    sarama.parse('6').should.deepEqual(acorn.parse('6'));
  });
  it('seven', () => {
    sarama.parse('7').should.deepEqual(acorn.parse('7'));
  });
  it('eight', () => {
    sarama.parse('8').should.deepEqual(acorn.parse('8'));
  });
  it('nine', () => {
    sarama.parse('9').should.deepEqual(acorn.parse('9'));
  });
  it('ten', () => {
    sarama.parse('10').should.deepEqual(acorn.parse('10'));
  });
  it('forty two', () => {
    sarama.parse('42').should.deepEqual(acorn.parse('42'));
  });
  it('point forty two', () => {
    sarama.parse('.14').should.deepEqual(acorn.parse('.14'));
  });
  it('pi', () => {
    sarama.parse('3.14159').should.deepEqual(acorn.parse('3.14159'));
  });
  it('6 point zero two two e plus twenty three', () => {
    sarama.parse('6.02214179e+23').should.deepEqual(acorn.parse('6.02214179e+23'));
  });
  it('6 point four nine e minus 10', () => {
    sarama.parse('1.492417830e-10').should.deepEqual(acorn.parse('1.492417830e-10'));
  });
});