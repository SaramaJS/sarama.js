# Filbert

JavaScript-based Python parser.  Outputs an abstract syntax tree as specified by the
[Mozilla Parser API][mozapi].

This parser is a work in progress, adapted from the JavaScript parser [`Acorn`][acorn].

[acorn]: https://github.com/marijnh/acorn

## Installation

TODO:

## Usage

TODO:

## What's Left?

Python3 is the target language.  
Much of the language is working.  Some parts remain, and are outlined below.

### Keywords     

Supported:
>False None True and break class continue def elif else for if in is not or pass return while

Unsupported:
>as assert del except finally from import global lambda nonlocal raise try with yield

### Built-ins   

Supported:
>int() len() print() range()

Unsupported:
>abs() all() any() ascii() bin() bool() bytearray() bytes() callable() chr() classmethod() compile() complex() delattr() dict() dir() divmod() enumerate() eval() exec() filter() float() format() frozenset() getattr() globals() hasattr() hash() help() hex() id() input() isinstance() issubclass() iter() list() locals() map() max() memoryview() min() next() object() oct() open() ord() pow() property() repr() reversed() round() set() setattr() slice() sorted() staticmethod() str() sum() super() tuple() type() vars() zip() __import__() 

### Language features

TODO: what's left?
