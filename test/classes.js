const acorn = require('acorn');
require('should');
const sarama = require('../loose');

describe('Classes', () => {
  it('Simple', () => {
    sarama.parse(`class MyClass:
    """A simple example class"""
    i = 12345

    def f(self):
        return 'hello world'`
    ).should.deepEqual(acorn.parse(`
    /** A simple example class
      */
    class MyClass {
      static get i() {
        return 12345;
      }
      
      f() {
        return 'hello world';
      }
    }
    `));
  });
});