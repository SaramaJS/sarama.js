const acorn = require('acorn');
const injectAcornStaticClassPropertyInitializer = require('acorn-static-class-property-initializer/inject');
require('should');

injectAcornStaticClassPropertyInitializer(acorn);

const sarama = require('../loose');
const sanitizer = require('../util/sanitizer');

describe('Classes', () => {
  it('Simple', () => {
    sanitizer(sarama.parse(`class MyClass:
    """A simple example class"""
    i = 12345

    def f(self):
        return 'hello world'`
    )).should.deepEqual(sanitizer(acorn.parse(`
    /** A simple example class
      */
    class MyClass {
      static i = 12345;
      f() {
        return 'hello world';
      }
    }
    `, {
      plugins: { staticClassPropertyInitializer: true }
    })));
  });
});