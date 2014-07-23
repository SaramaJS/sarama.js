var util = require('./util.js');

describe("Class", function () {
  it("data attribute", function () {
    var code = "\
    class MyClass:\n\
      i = 12345\n\
    x = MyClass()\n\
    return x.i\n\
    ";
    expect(util.run(code)).toBe(12345);
  });

  it("method attribute", function () {
    var code = "\
    class MyClass:\n\
      def f(self):\n\
          return 'hello world'\n\
    x = MyClass()\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('hello world');
  });

  it("global scope", function () {
    var code = "\
    s = 'global scope'\n\
    class MyClass:\n\
      s = 'class scope'\n\
      def f(self):\n\
        s ='method scope'\n\
        return s\n\
      def b(self):\n\
        return s\n\
    x = MyClass()\n\
    return s\n\
    ";
    expect(util.run(code)).toBe('global scope');
  });

  it("global scope, via method", function () {
    var code = "\
    s = 'global scope'\n\
    class MyClass:\n\
      s = 'class scope'\n\
      def f(self):\n\
        s ='method scope'\n\
        return s\n\
      def b(self):\n\
        return s\n\
    x = MyClass()\n\
    return x.b()\n\
    ";
    expect(util.run(code)).toBe('global scope');
  });


  it("class scope, class var", function () {
    var code = "\
    s = 'global scope'\n\
    class MyClass:\n\
      s = 'class scope'\n\
      def f(self):\n\
        s ='method scope'\n\
        return s\n\
      def b(self):\n\
        return s\n\
    x = MyClass()\n\
    return x.s\n\
    ";
    expect(util.run(code)).toBe('class scope');
  });

  it("class scope, class var via method", function () {
    var code = "\
    s = 'global scope'\n\
    class MyClass:\n\
      s = 'class scope'\n\
      def f(self):\n\
        s ='method scope'\n\
        return s\n\
      def b(self):\n\
        return self.s\n\
    x = MyClass()\n\
    return x.b()\n\
    ";
    expect(util.run(code)).toBe('class scope');
  });

  it("class scope, method var", function () {
    var code = "\
    s = 'global scope'\n\
    class MyClass:\n\
      s = 'class scope'\n\
      def f(self):\n\
        s ='method scope'\n\
        return s\n\
      def b(self):\n\
        return s\n\
    x = MyClass()\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('method scope');
  });

  it("call between class methods", function () {
    var code = "\
    class MyClass:\n\
      def f(self):\n\
        return self.b()\n\
      def b(self):\n\
        return 'hello world'\n\
    x = MyClass()\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('hello world');
  });

  it("__init__", function () {
    var code = "\
    class MyClass:\n\
      def __init__(self):\n\
        self.data = 7\n\
      def f(self):\n\
        return self.data\n\
    x = MyClass()\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe(7);
  });

  it("__init__ with args", function () {
    var code = "\
    class MyClass:\n\
      def __init__(self, a, b):\n\
        self.data = a + b\n\
      def f(self):\n\
        return self.data\n\
    x = MyClass(4, 5)\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe(9);
  });

  //it("add data attribute to class object", function () {
  //  var code = "\
  //  class MyClass:\n\
  //    def f(self):\n\
  //      return 'hello world'\n\
  //  x = MyClass()\n\
  //  MyClass.data = 3\n\
  //  return x.data\n\
  //  ";
  //  expect(util.run(code)).toBe(3);
  //});

  //it("add method to class object", function () {
  //  var code = "\
  //  class MyClass:\n\
  //    data = 34\n\
  //  def f(self):\n\
  //    return self.data\n\
  //  x = MyClass()\n\
  //  MyClass.f = f\n\
  //  return x.f()\n\
  //  ";
  //  expect(util.run(code)).toBe(34);
  //});

  it("add data attribute to instance", function () {
    var code = "\
    class MyClass:\n\
      def f(self):\n\
        return 'hello world'\n\
    x = MyClass()\n\
    x.data = 3\n\
    return x.data\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("add method to instance", function () {
    var code = "\
    class MyClass:\n\
      data = 34\n\
    def f(self):\n\
      return self.data\n\
    x = MyClass()\n\
    x.f = f\n\
    return x.f(x)\n\
    ";
    expect(util.run(code)).toBe(34);
  });

  // TODO: can use bind: xf = x.f.bind(x) or xf.bind(x)()
  //it("save method locally and call", function () {
  //  var code = "\
  //  class MyClass:\n\
  //    def __init__(self, s):\n\
  //      self.s = s\n\
  //    def f(self):\n\
  //      return self.s\n\
  //  x = MyClass('hello world')\n\
  //  xf = x.f\n\
  //  return xf()\n\
  //  ";
  //  expect(util.run(code)).toBe('hello word');
  //});

  it("single inheritance, direct method call", function () {
    var code = "\
    class ParentClass:\n\
      def f(self):\n\
        return 'hello world'\n\
    class MyClass(ParentClass):\n\
      def __init__(self, s):\n\
        self.s = s\n\
    x = MyClass('test')\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('hello world');
  });

  it("single inheritance, child method call", function () {
    var code = "\
    class ParentClass:\n\
      def f(self):\n\
        return 'hello world'\n\
    class MyClass(ParentClass):\n\
      def b(self):\n\
        return self.f()\n\
    x = MyClass()\n\
    return x.b()\n\
    ";
    expect(util.run(code)).toBe('hello world');
  });

  it("single inheritance, data attribute", function () {
    var code = "\
    class ParentClass:\n\
      data = 6\n\
    class MyClass(ParentClass):\n\
      def b(self):\n\
        return self.data\n\
    x = MyClass()\n\
    return x.b()\n\
    ";
    expect(util.run(code)).toBe(6);
  });

  it("single inheritance, method override", function () {
    var code = "\
    class ParentClass:\n\
      def f(self):\n\
        return 'parent'\n\
    class MyClass(ParentClass):\n\
      def f(self):\n\
        return 'child'\n\
    x = MyClass()\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('child');
  });

  it("single inheritance chain", function () {
    var code = "\
    class GrandParentClass:\n\
      def f(self):\n\
        return 'hello world'\n\
    class ParentClass(GrandParentClass):\n\
      data = 'parent data'\n\
    class MyClass(ParentClass):\n\
      def __init__(self, d):\n\
        data = d\n\
    x = MyClass(88)\n\
    return x.f()\n\
    ";
    expect(util.run(code)).toBe('hello world');
  });

  it("empty class", function () {
    var code = "\
    class MyClass():\n\
      pass\n\
    x = MyClass()\n\
    x.data = 'pass is an EmptyStatement'\n\
    return x.data\n\
    ";
    expect(util.run(code)).toBe('pass is an EmptyStatement');
  });

  it("class/function name conflict", function () {
    var code = "\
    class MyClass():\n\
      data = 99\n\
    x = MyClass()\n\
    def MyClass():\n\
      return 123\n\
    x = MyClass()\n\
    return x\n\
    ";
    expect(util.run(code)).toBe(123);
  });

  // TODO: Identify calls to user-defined class methods
  //it("default arguments", function () {
  //  var code = "\
  //  class MyClass():\n\
  //    def f(self, x, y=5, z=8, *a, **b):\n\
  //        return x + y + z + sum(a) + sum([b[k] for k in b])\n\
  //  x = MyClass()\n\
  //  return x.f(1)\n\
  //  ";
  //  expect(util.run(code)).toEqual(14);
  //});

  //it("keyword arguments", function () {
  //  var code = "\
  //  class MyClass():\n\
  //    def f(self, x, y=5, z=8, *a, **b):\n\
  //        return x + y + z + sum(a) + sum([b[k] for k in b])\n\
  //  x = MyClass()\n\
  //  return x.f(2, z=1, y=9)\n\
  //  ";
  //  expect(util.run(code)).toEqual(12);
  //});

  //it("*args and **kwargs", function () {
  //  var code = "\
  //  class MyClass():\n\
  //    def f(self, x, y=5, z=8, *a, **b):\n\
  //        return x + y + z + sum(a) + sum([b[k] for k in b])\n\
  //  x = MyClass()\n\
  //  return x.f(1, 2, 3, 4, 5, a=10, b=100)\n\
  //  ";
  //  expect(util.run(code)).toEqual(125);
  //});

});