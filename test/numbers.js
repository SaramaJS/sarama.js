const acorn = require('acorn');
require('should');
const sarama = require('../loose');
const sanitizer = require('../util/sanitizer');

describe('Numbers', () => {
  it('zero', () => {
    sanitizer(sarama.parse('0')).should.deepEqual(sanitizer(acorn.parse('0')));
  });
  it('one', () => {
    sanitizer(sarama.parse('1')).should.deepEqual(sanitizer(acorn.parse('1')));
  });
  it('two', () => {
    sanitizer(sarama.parse('2')).should.deepEqual(sanitizer(acorn.parse('2')));
  });
  it('three', () => {
    sanitizer(sarama.parse('3')).should.deepEqual(sanitizer(acorn.parse('3')));
  });
  it('four', () => {
    sanitizer(sarama.parse('4')).should.deepEqual(sanitizer(acorn.parse('4')));
  });
  it('five', () => {
    sanitizer(sarama.parse('5')).should.deepEqual(sanitizer(acorn.parse('5')));
  });
  it('six', () => {
    sanitizer(sarama.parse('6')).should.deepEqual(sanitizer(acorn.parse('6')));
  });
  it('seven', () => {
    sanitizer(sarama.parse('7')).should.deepEqual(sanitizer(acorn.parse('7')));
  });
  it('eight', () => {
    sanitizer(sarama.parse('8')).should.deepEqual(sanitizer(acorn.parse('8')));
  });
  it('nine', () => {
    sanitizer(sarama.parse('9')).should.deepEqual(sanitizer(acorn.parse('9')));
  });
  it('ten', () => {
    sanitizer(sarama.parse('10')).should.deepEqual(sanitizer(acorn.parse('10')));
  });
  it('forty two', () => {
    sanitizer(sarama.parse('42')).should.deepEqual(sanitizer(acorn.parse('42')));
  });
  it('point forty two', () => {
    sanitizer(sarama.parse('.14')).should.deepEqual(sanitizer(acorn.parse('.14')));
  });
  it('pi', () => {
    sanitizer(sarama.parse('3.14159')).should.deepEqual(sanitizer(acorn.parse('3.14159')));
  });
  it('6 point zero two two e plus twenty three', () => {
    sanitizer(sarama.parse('6.02214179e+23')).should.deepEqual(sanitizer(acorn.parse('6.02214179e+23')));
  });
  it('6 point four nine e minus 10', () => {
    sanitizer(sarama.parse('1.492417830e-10')).should.deepEqual(sanitizer(acorn.parse('1.492417830e-10')));
  });
});