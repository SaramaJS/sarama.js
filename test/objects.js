const acorn = require('acorn');
require('should');
const sarama = require('../loose');
const sanitizer = require('../util/sanitizer');
describe('Objects', () => {
  it('this', () => {
    sanitizer(sarama.parse('this\n', { locations: false })).should.deepEqual(sanitizer(acorn.parse('this;\n', { locations: false })));
  });
  it('null', () => {
    sanitizer(sarama.parse('None\n', { locations: false })).should.deepEqual(sanitizer(acorn.parse('null;\n', { locations: false })));
  });
});