# Filbert

JavaScript-based Python parser.  Outputs an abstract syntax tree as specified by the
[Mozilla Parser API][mozapi].

[mozapi]: https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API

This parser is a work in progress, adapted from the JavaScript parser [Acorn][acorn].

[acorn]: https://github.com/marijnh/acorn

## Installation

TODO:

## Usage

TODO:

## Testing

```sh
grunt test
```

## Language Support

Python3 is the target language.  Much of it is working, and the remaining pieces are outlined below.

### Keywords     

Supported:
>False None True and break class continue def elif else for if in is not or pass return while

Unsupported:
>as assert del except finally from import global lambda nonlocal raise try with yield

### Built-ins   

Supported:
>abs() all() any() bool() chr() dict() enumerate() filter() float() hex() int() len() list() map() max() min() oct() ord() pow() print() range() repr() reversed() round() sorted() str() sum() tuple()

Unsupported:
>ascii() bin() bytearray() bytes() callable() classmethod() compile() complex() delattr() dir() divmod() eval() exec() format() frozenset() getattr() globals() hasattr() hash() help() id() input() isinstance() issubclass() iter() locals() memoryview() next() object() open() property() set() setattr() slice() staticmethod() super() type() vars() zip() \__import__() 

### Language features

TODO: what's left?

