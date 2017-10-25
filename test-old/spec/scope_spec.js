var util = require('./util.js');

describe("Scope", function () {
  it("simple", function () {
    var code = "\
    x = 5\n\
    return x\n\
    ";
    expect(util.run(code)).toBe(5);
  });

  it("global from function", function () {
    var code = "\
    x = 'global'\n\
    def f():\n\
      return x\n\
    return f()\n\
    ";
    expect(util.run(code)).toBe('global');
  });

  it("local from function", function () {
    var code = "\
    x = 'global'\n\
    def f():\n\
      x = 'function'\n\
      return x\n\
    return f()\n\
    ";
    expect(util.run(code)).toBe('function');
  });

  it("modify local does not change global", function () {
    var code = "\
    x = 'global'\n\
    def f():\n\
      x = 'function'\n\
    f()\n\
    return x\n\
    ";
    expect(util.run(code)).toBe('global');
  });

  it("local fn var not available globally", function () {
    var code = "\
    def f():\n\
      x = 'function'\n\
    f()\n\
    if x: return True\n\
    else: return False\n\
    ";
    var err = util.run(code);
    expect(err.message).toEqual("x is not defined");
  });

  it("local class var not available globally", function () {
    var code = "\
    class MyClass:\n\
      x = 'class'\n\
    c = MyClass()\n\
    if x: return True\n\
    else: return False\n\
    ";
    var err = util.run(code);
    expect(err.message).toEqual("x is not defined");
  });

  it("global var from class data attribute", function () {
    var code = "\
    x = 'global'\n\
    class MyClass:\n\
      data = x\n\
      def foo(self):\n\
        return self.data\n\
    c = MyClass()\n\
    return c.data\n\
    ";
    expect(util.run(code)).toEqual('global');
  });

  it("global var from class method", function () {
    var code = "\
    x = 'global'\n\
    class MyClass:\n\
      data = x\n\
      def foo(self):\n\
        return self.data\n\
    c = MyClass()\n\
    return c.foo()\n\
    ";
    expect(util.run(code)).toEqual('global');
  });
  it("dont clobber func params", function () {
    var code = "\
    def foo(x):\n\
      x += 10\n\
      return x\n\
    return foo(7)\n\
    ";
    expect(util.run(code)).toEqual(17);
  });
});