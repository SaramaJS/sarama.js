var util = require('./util.js');

describe("Runtime library tests", function () {
  it("abs(-2)", function () {
    var code = "\
    return abs(-2)\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("all(true)", function () {
    var code = "\
    return all([1, True])\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("all(false)", function () {
    var code = "\
    return all([1, True, False])\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("any(true)", function () {
    var code = "\
    return any([False, 0, True])\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("all(false)", function () {
    var code = "\
    return all([0, False, ''])\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("ascii()", function () {
    var code = "\
    return ascii(\"TEST\\xD4\\u1234\\U00028B4E\")\
    ";
    expect(util.run(code)).toBe("'TEST\\xd4\\u1234\\U00028b4e'");
  });

  it("bool(None)", function () {
    var code = "\
    return bool(None)\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("bool(2)", function () {
    var code = "\
    return bool(2)\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("bool(2.5)", function () {
    var code = "\
    return bool(2.5)\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("bool(0)", function () {
    var code = "\
    return bool(0)\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("bool('')", function () {
    var code = "\
    return bool('')\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("bool('test')", function () {
    var code = "\
    return bool('test')\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("bool([])", function () {
    var code = "\
    return bool([])\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("bool((3,4))", function () {
    var code = "\
    return bool((3,4))\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("bool() with __bool__", function () {
    var code = "\
    class MyClass():\n\
      def __bool__(self):\n\
        return True\n\
    x = MyClass()\n\
    return bool(x)\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("bool() with __len__", function () {
    var code = "\
    class MyClass():\n\
      def __len__(self):\n\
        return 0\n\
    x = MyClass()\n\
    return bool(x)\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("bool() with nothing", function () {
    var code = "\
    class MyClass():\n\
      pass\n\
    x = MyClass()\n\
    return bool(x)\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("chr(97)", function () {
    var code = "\
    return chr(97)\
    ";
    expect(util.run(code)).toEqual('a');
  });

  it("divmod(17, 6)", function () {
    var code = "\
    return str(divmod(17, 6))";
    expect(util.run(code)).toEqual('(2, 5)');
  });

  it("enumerate(seq)", function () {
    var code = "\
    seasons = ['Spring', 'Summer', 'Fall', 'Winter']\n\
    e = enumerate(seasons)\n\
    return e[1][0]\
    ";
    expect(util.run(code)).toEqual(1);
  });

  it("enumerate(seq, 7)", function () {
    var code = "\
    seasons = ['Spring', 'Summer', 'Fall', 'Winter']\n\
    e = enumerate(seasons, 7)\n\
    return e[1][0]\
    ";
    expect(util.run(code)).toEqual(8);
  });

  it("filter(fn, seq)", function () {
    var code = "\
    def f(i):\n\
      return i == 'b'\n\
    return filter(f, ['a', 'b'])\
    ";
    expect(util.run(code)).toEqual(['b']);
  });

  it("filter(None, seq)", function () {
    var code = "\
    return filter(None, ['a', 'b'])\
    ";
    expect(util.run(code)).toEqual(['a', 'b']);
  });

  it("float('+1E6')", function () {
    var code = "\
    return float('+1E6')\
    ";
    expect(util.run(code)).toEqual(1000000);
  });

  it("hex(15)", function () {
    var code = "\
    return hex(15)\
    ";
    expect(util.run(code)).toEqual('f');
  });

  it("hex(15)", function () {
    var code = "\
    return hex(15)\
    ";
    expect(util.run(code)).toEqual('f');
  });

  it("int('5')", function () {
    var code = "\
    return int('5')\n\
    ";
    expect(util.run(code)).toEqual(5);
  });
  it("int('0')", function () {
    var code = "\
    return int('0')\n\
    ";
    expect(util.run(code)).toEqual(0);
  });
  it("int('-5')", function () {
    var code = "\
    return int('-5')\n\
    ";
    expect(util.run(code)).toEqual(-5);
  });

  it("len('hi')", function () {
    var code = "\
    return len('hi')\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("len([1, 3, 4])", function () {
    var code = "\
    d = [1, 3, 4]\n\
    return len(d)\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("list([5, 3, -24])", function () {
    var code = "\
    d = list([5, 3, -24])\n\
    return d[2]\n\
    ";
    expect(util.run(code)).toBe(-24);
  });

  it("list({'one':1, 'two':2})", function () {
    var code = "\
    d = list({'one':1, 'two':2})\n\
    return d[1]\n\
    ";
    expect(util.run(code)).toBe('two');
  });

  it("map()", function () {
    var code = "\
    def add2(a):\n\
      return a + 2\n\
    d = map(add2, [1, 2, 3])\n\
    return d[2]\n\
    ";
    expect(util.run(code)).toEqual(5);
  });

  it("max(-1, -234)", function () {
    var code = "\
    return max(-1, -234)\n\
    ";
    expect(util.run(code)).toEqual(-1);
  });

  it("max([1, 2, -34, 23423])", function () {
    var code = "\
    return max([1, 2, -34, 23423])\n\
    ";
    expect(util.run(code)).toEqual(23423);
  });

  it("min(-1, -234)", function () {
    var code = "\
    return min(-1, -234)\n\
    ";
    expect(util.run(code)).toEqual(-234);
  });

  it("min([1, 2, -34, 23423])", function () {
    var code = "\
    return min([1, 2, -34, 23423])\n\
    ";
    expect(util.run(code)).toEqual(-34);
  });

  it("oct(9)", function () {
    var code = "\
    return oct(9)\n\
    ";
    expect(util.run(code)).toEqual('11');
  });

  it("ord(\u2020)", function () {
    var code = "\
    return ord('\u2020')\n\
    ";
    expect(util.run(code)).toEqual(8224);
  });

  it("pow(2, 3)", function () {
    var code = "\
    return pow(2, 3)\n\
    ";
    expect(util.run(code)).toEqual(8);
  });

  it("pow(2, 3, 7)", function () {
    var code = "\
    return pow(2, 3, 7)\n\
    ";
    expect(util.run(code)).toEqual(1);
  });

  it("range(3)", function () {
    var code = "\
    return range(3)\n\
    ";
    expect(util.run(code)).toEqual([0, 1, 2]);
  });

  it("range(2, 5)", function () {
    var code = "\
    return range(2, 5)\n\
    ";
    expect(util.run(code)).toEqual([2, 3, 4]);
  });

  it("range(0, 30, 10)", function () {
    var code = "\
    return range(0, 30, 10)\n\
    ";
    expect(util.run(code)).toEqual([0, 10, 20]);
  });

  it("range(0, -5, -1)", function () {
    var code = "\
    return range(0, -5, -1)\n\
    ";
    expect(util.run(code)).toEqual([0, -1, -2, -3, -4]);
  });

  it("range(1, 0)", function () {
    var code = "\
    return range(1, 0)\n\
    ";
    expect(util.run(code)).toEqual([]);
  });

  it("range(1, 0)", function () {
    var code = "\
    return range(1, 0)\n\
    ";
    expect(util.run(code)).toEqual([]);
  });

  it("range(0, 10, 4)", function () {
    var code = "\
    return range(0, 10, 4)\n\
    ";
    expect(util.run(code)).toEqual([0, 4, 8]);
  });

  it("range(9, -2, -4)", function () {
    var code = "\
    return range(9, -2, -4)\n\
    ";
    expect(util.run(code)).toEqual([9, 5, 1]);
  });

  it("repr()", function () {
    var code = "\
    return repr(88)\n\
    ";
    expect(util.run(code)).toEqual('88');
  });

  it("repr()", function () {
    var code = "\
    return repr(\"88\")\n\
    ";
    expect(util.run(code)).toEqual("'88'");
  });

  it("reversed()", function () {
    var code = "\
    return reversed(['a', 'b'])\n\
    ";
    expect(util.run(code)).toEqual(['b', 'a']);
  });

  it("round(10.4)", function () {
    var code = "\
    return round(10.4)\n\
    ";
    expect(util.run(code)).toEqual(10);
  });

  it("round(2.675, 2)", function () {
    var code = "\
    return round(2.675, 2)\n\
    ";
    expect(util.run(code)).toEqual(2.68);
  });

  it("sorted([2, 1])", function () {
    var code = "\
    a = [2, 1]\n\
    return sorted(a)\n\
    ";
    expect(util.run(code)).toEqual([1, 2]);
  });

  it("sorted([2, 1], cmp)", function () {
    var code = "\
    def cmp(x):\n\
      return -x\n\
    a = [2, 1]\n\
    return sorted(a, cmp)\n\
    ";
    expect(util.run(code)).toEqual([2, 1]);
  });

  it("sorted([2, 1], cmp, True)", function () {
    var code = "\
    def cmp(x):\n\
      return -x\n\
    a = [2, 1]\n\
    return sorted(a, cmp, True)\n\
    ";
    expect(util.run(code)).toEqual([1, 2]);
  });

  it("str()", function () {
    var code = "\
    return str(4)\n\
    ";
    expect(util.run(code)).toEqual('4');
  });

  it("sum([1, 2, 3])", function () {
    var code = "\
    return sum([1, 2, 3])\n\
    ";
    expect(util.run(code)).toEqual(6);
  });

  it("tuple((1, 2, 3))", function () {
    var code = "\
    t = tuple((1, 2, 3))\n\
    return t._type == 'tuple'\
    ";
    expect(util.run(code)).toEqual(true);
  });

  it("tuple([1, 223, 3])", function () {
    var code = "\
    t = tuple([1, 223, 3])\n\
    return t._type == 'tuple'\
    ";
    expect(util.run(code)).toEqual(true);
  });

  it("createList(4, 3, 'mahalo', 8998)", function () {
    var code = "\n\
    return __pythonRuntime.utils.createList(4, 3, 'mahalo', 8998)";
    var list = util.run(code);
    expect(list._isPython).toBe(true);
    expect(list).toEqual([4, 3, 'mahalo', 8998]);
  });

  it("convertToList(['a', 'zoo', True, 45])", function () {
    var code = "\n\
    myList = ['a', 'zoo', True, 45]\n\
    __pythonRuntime.utils.convertToList(myList)\n\
    return myList";
    var list = util.run(code);
    expect(list._isPython).toBe(true);
    expect(list).toEqual(['a', 'zoo', true, 45]);
  });
  
  it("createList(['a', 'zoo', True, 45])", function () {
    var code = "\n\
    return __pythonRuntime.utils.createList(['a', 'zoo', True, 45])";
    var list = util.run(code);
    expect(list._isPython).toBe(true);
    expect(list).toEqual(['a', 'zoo', true, 45]);
  });

  it("convertToDict({'p1': 45, 'p2': False, 'p3': 'Bob'})", function () {
    var code = "\n\
    d = {'p1': 45, 'p2': False, 'p3': 'Bob'}\n\
    d['randoProp'] = 'hi'\n\
    __pythonRuntime.utils.convertToDict(d)\n\
    return d";
    var dict = util.run(code);
    expect(dict._isPython).toBe(true);
    expect(dict).toEqual({'p1': 45, 'p2': false, 'p3': 'Bob', 'randoProp': 'hi'});
  });
  
  it("createDict({'p1': 45, 'p2': False, 'p3': 'Bob'})", function () {
    var code = "\n\
    return __pythonRuntime.utils.createDict({'p1': 45, 'p2': False, 'p3': 'Bob'})";
    var dict = util.run(code);
    expect(dict._isPython).toBe(true);
    expect(dict).toEqual({'p1': 45, 'p2': false, 'p3': 'Bob'});
  });

  it("createDict({'type': 'merino wool'})", function () {
    var code = "\n\
    return __pythonRuntime.utils.createDict({'type': 'merino wool'})";
    var dict = util.run(code);
    expect(dict._type).toBe('dict');
    expect(dict.type).toBe('merino wool');
    expect(dict).toEqual({'type': 'merino wool'});
  });


});
