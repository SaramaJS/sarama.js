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
    else:\n\
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

});