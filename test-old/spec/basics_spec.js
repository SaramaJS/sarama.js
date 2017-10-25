var util = require('./util.js');

describe("Basics", function () {
  it("return 1000", function () {
    var code = "return 1000";
    expect(util.run(code)).toBe(1000);
  });

  it("simple if", function () {
    var code = "\
    if False: return 2000\n\
    return 1000\n\
    ";
    expect(util.run(code)).toBe(1000);
  });

  it("no indent, if elif else, if", function () {
    var code = "\
    x = 2\n\
    if x == 2: return '2'\n\
    elif x == 4: return '4'\n\
    else: return 'else'\n\
    ";
    expect(util.run(code)).toBe('2');
  });

  it("no indent, if elif else, elif", function () {
    var code = "\
    x = 4\n\
    if x == 2: return '2'\n\
    elif x == 4: return '4'\n\
    else: return 'else'\n\
    ";
    expect(util.run(code)).toBe('4');
  });

  it("no indent, if elif else, else", function () {
    var code = "\
    x = -0\n\
    if x == 2: return '2'\n\
    elif x == 4: return '4'\n\
    else: return 'else'\n\
    ";
    expect(util.run(code)).toBe('else');
  });

  it("with indent, if elif else, else", function () {
    var code = "\
x = -0\n\
if x == 2:\n\
  return '2'\n\
elif x == 4:\n\
  return '4'\n\
else  :\n\
  return 'else'\n\
    ";
    expect(util.run(code)).toBe('else');
  });

  it("with indent, if elif else, if", function () {
    var code = "\
    x = 2\n\
    if x == 2:\n\
      return '2'\n\
    elif x == 4:\n\
      return '4'\n\
    else:\n\
      return 'else'\n\
    ";
    expect(util.run(code)).toBe('2');
  });

  it("with indent, if elif else, elif", function () {
    var code = "\
    x = 4\n\
    if x == 2:\n\
      return '2'\n\
    elif x == 4:\n\
      return '4'\n\
    else:\n\
      return 'else'\n\
    ";
    expect(util.run(code)).toBe('4');
  });

  it("multiple elif", function () {
    var code = "\
    x = 4\n\
    if x == 2:\n\
      x += 1\n\
      return '2'\n\
    elif x == 44564:\n\
      x += 1\n\
      return '44564'\n\
    elif x == 4:\n\
      x += 1\n\
      return '4'\n\
    ";
    expect(util.run(code)).toBe('4');
  });

  it("mathmetics order", function () {
    var code = "\
    return (2*2 + 2/2 - 2*2/2)\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("fibonacci function", function () {
    var code = "\
    def fib(n):\n\
      if n < 2: return n\n\
      else: return fib(n - 1) + fib(n - 2)\n\
    chupacabra = fib(6)\n\
    return chupacabra\n\
    ";
    expect(util.run(code)).toBe(8);
  });

  it("while loop", function () {
    var code = "\
    data = [4, 2, 65, 7]\n\
    total = 0\n\
    i = 0\n\
    while total < 60:\n\
      total += data[i]\n\
      i += 1\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(71);
  });

  it("while loop single line", function () {
    var code = "\
    total = 0\n\
    while total < 5: total += 1\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(5);
  });

  it("for loop", function () {
    var code = "\
    data = [4, 2, 65, 7]\n\
    total = 0\n\
    for d in data:\n\
      total += d\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(78);
  });

  it("bubble sort", function () {
    var code = "\
    import random\n\
    def createShuffled(n):\n\
      r = n * 10 + 1\n\
      shuffle = []\n\
      for i in range(n):\n\
        item = int(r * random.random())\n\
        shuffle.append(item)\n\
      return shuffle\n\
    \n\
    def bubbleSort(data):\n\
      sorted = False\n\
      while not sorted:\n\
        sorted = True\n\
        for i in range(len(data) - 1):\n\
          if data[i] > data[i + 1]:\n\
            t = data[i]\n\
            data[i] = data[i + 1]\n\
            data[i + 1] = t\n\
            sorted = False\n\
      return data\n\
    \n\
    def isSorted(data):\n\
      for i in range(len(data) - 1):\n\
        if data[i] > data[i + 1]:\n\
          return False\n\
      return True\n\
    \n\
    data = createShuffled(10)\n\
    bubbleSort(data)\n\
    return isSorted(data)\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("break", function () {
    var code = "\
    total = 0\n\
    for n in range(5):\n\
      if n > 2:\n\
        break\n\
      total += 1\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("continue", function () {
    var code = "\
    total = 0\n\
    for n in range(5):\n\
      total += 1\n\
      if n < 2:\n\
        continue\n\
      break\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("return no param", function () {
    var code = "\
    def foo():\n\
      x = 5\n\
      return\n\
    foo()\n\
    return 7\n\
    ";
    expect(util.run(code)).toBe(7);
  });

  it("newlines", function () {
    var code = "\
    def f():\n\
    \u2028\
      data = [4, 2, 65, 7]\n\
      \r\n\
      total = 0\r\n\
      \n\
      for d in data:\n\
      \n\r\
        total += d\u2028\
      \u2029\u2029\u2029\n\
      return total\n\
    \u2029\
    return f()\n\
    ";
    expect(util.run(code)).toBe(78);
  });

  it("multi-statement lines", function () {
    var code = "h='Hello'; w='World'; print(h); print(w); return h;";
    expect(util.run(code)).toEqual('Hello');
  });

  it("multi-statement lines error", function () {
    var code = "h='Hello' w='World' print(h) print(w)";
    var err = util.run(code);
    expect(err.message).toEqual("Unexpected token");
  });

  it("default arguments", function () {
    var code = "\
    def f(x, y=5, z=7):\n\
      return x + y + z\n\
    return f(1)";
    expect(util.run(code)).toEqual(13);
  });

  it("keyword arguments", function () {
    var code = "\
    def f(x, y=5, z=7):\n\
      return x + y + z\n\
    return f(1, z=2, y=50)";
    expect(util.run(code)).toEqual(53);
  });

  it("*args", function () {
    var code = "\
    def f(x, y=5, z=7, *a):\n\
      return x + y + z + sum(a)\n\
    return f(1, 2, 50, 5, 6)";
    expect(util.run(code)).toEqual(64);
  });

  it("**kwargs", function () {
    var code = "\
    def f(x, y=5, z=7, **a):\n\
      return x + y + z + sum([a[k] for k in a])\n\
    return f(1, z=2, y=50, a=5, b=16)";
    expect(util.run(code)).toEqual(74);
  });
  
  it("*args and **kwargs", function () {
    var code = "\
    def f(x, y=5, z=8, *a, **b):\n\
        return x + y + z + sum(a) + sum([b[k] for k in b])\n\
    return f(1, 2, 3, 4, 5, a=10, b=100)\n\
    ";
    expect(util.run(code)).toEqual(125);
  });

  it("None function param", function () {
    var code = "\
    def is_sandyak(enemy):\n\
      return False\n\
    def is_soldier(enemy):\n\
      if enemy and not is_sandyak(enemy):\n\
        return True\n\
      return False\n\
    enemy = None\n\
    if is_soldier(enemy):\n\
      print('Let us flee.')\n\
      return True\n\
    return False\n\
    ";
    expect(util.run(code)).toEqual(false);
  });

  it("Explicit line continuation", function () {
    var code = "\
    return 1+\\\n\
    2\\\n\
    +3";
    expect(util.run(code)).toBe(6);
  })
  
});