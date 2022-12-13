# compact-encoding-struct

Generate compact encodings from defined structs

## Usage
```js
const c = require('compact-encoding')
const { compile, opt, array, flag, constant } = require('compact-encoding-struct')

const struct = {
  type: constant(c.uint, 1),
  start: c.uint,
  length: opt(c.uint),
  nodes: array(c.buffer),
  block: flag()
}

const cstruct = compile(struct)

const enc = c.encode(cstruct, someMessage)
const sameMessage = c.decode(compile(struct), enc)
```

## API

#### `const cenc = compile(struct)`

`struct` should be an object of field names and their corresponding compact encodings.

To specify and array encoding simply pass `[encoding]` in place of `encoding`
```
{
  lengths: [c.uint],
}
```

Returns compact encodings for `struct`:
```
{
  encode,
  preencode,
  decode
}
```

#### `{ array: array(enc) }`

`array` is a helper function to designate array encodings. It operates the same as `[enc]` described above.

#### `{ optional: opt(enc, [defaultValue = null]) }`

`opt` is a helper function to designate optional fields.

If the field is present it shal be encoded and decoded using compact encoding `enc`.

If the field was not present in the encoded message, the decoded value will be set to `defaultValue`.

#### `{ flag: flag }`

`flag` is a compact-encoding defined for setting flag bits. The value in the message should be `true`/`false` and will be encoded/decoded using a bitfield to save bytes.

#### `{ constant: constant(enc, val) }`

`constant` encodes a fixed value `val` for all messages, even if this field is already set.

It acts as a static property on the encoded/decoded message, decoding will throw if the encoded value does not match the expected value.

#### `const enc = either(encodings, test)`

`either` encodes a value as one of a set of predefined encodings.

`encodings` should be an array of compact-encodings and `test` should return the index in this array that should be used to encode a value.

```js
const enc = either([c.string, c.uint], value => {
  return typeof value === 'string' ? 0 : 1
})
````

#### `{ header: header(enc, val) }`

`header` encodes a value in the header at the start of the encoded message.

The header can be fetched at the using the `getHeader` method.

#### getHeader(buf, struct)

This method fetches the header of an encoded message and returns.

`struct` should be an object representing the field names and encodings of the header.
