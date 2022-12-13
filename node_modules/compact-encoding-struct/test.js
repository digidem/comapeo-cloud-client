const c = require('compact-encoding')
const { compile, opt, array, flag, constant, header, getHeader, either } = require('./')
const test = require('tape')

test('compile encoding', t => {
  const struct = {
    start: c.uint,
    length: c.uint,
    nodes: c.buffer,
    additionalNodes: c.buffer,
    signature: c.fixed64
  }

  const cstruct = compile(struct)

  const test = {
    start: 12,
    length: 176,
    nodes: Buffer.from('1234567890abcdefghijklmnopqrstuvwxyz'),
    additionalNodes: Buffer.from('efghijklmnopqrstuvwxyz1234567890abcd'),
    signature: Buffer.alloc(64, 1)
  }

  const enc = c.encode(cstruct, test)
  t.same(test, c.decode(cstruct, enc), 'simple')

  const nested = {
    start: c.uint,
    length: c.uint,
    nodes: c.buffer,
    struct: cstruct,
    signature: c.fixed64
  }

  const testNest = {
    start: 12,
    length: 176,
    nodes: Buffer.from('1234567890abcdefghijklmnopqrstuvwxyz'),
    struct: test,
    signature: Buffer.alloc(64, 1)
  }

  const nestenc = c.encode(compile(nested), testNest)
  t.same(testNest, c.decode(compile(nested), nestenc), 'nested')

  t.end()
})

test('array encoding', t => {
  const struct = {
    length: [c.uint]
  }

  const cstruct = compile(struct)

  const test = {
    length: [176, 23, 14, 37, 3485792]
  }

  const enc = c.encode(cstruct, test)
  t.same(test, c.decode(cstruct, enc), 'simple')

  const nested = {
    nest: [cstruct]
  }

  const testNest = {
    nest: [test, { length: [123, 456, 789] }]
  }

  const nestenc = c.encode(compile(nested), testNest)
  t.same(testNest, c.decode(compile(nested), nestenc), 'nested')

  t.end()
})

test('flag encoding', t => {
  const struct = {
    1: flag,
    2: flag,
    3: flag,
    4: flag,
    5: flag
  }

  const cstruct = compile(struct)

  const test = {
    1: true,
    2: false,
    3: true,
    4: false,
    5: false
  }

  const enc = c.encode(cstruct, test)
  t.same(enc.byteLength, 3, 'correct length')
  t.same(c.decode(cstruct, enc), test, 'simple')

  const nested = {
    nest: [cstruct]
  }

  const test2 = {
    1: false,
    2: false,
    3: true,
    4: true,
    5: false
  }
  const testNest = {
    nest: [test, test2]
  }

  const nestenc = c.encode(compile(nested), testNest)
  t.same(c.decode(compile(nested), nestenc), testNest, 'nested')

  t.end()
})

test('optional encoding', t => {
  const struct = {
    length: opt(c.uint),
    width: c.uint,
    memo: c.string
  }

  const cstruct = compile(struct)

  const test = {
    width: 32,
    memo: 'test without optional'
  }

  const enc = c.encode(cstruct, test)

  const exp = {
    length: null,
    ...test
  }
  t.same(c.decode(cstruct, enc), exp, 'without optional')

  const testWith = {
    length: 32,
    width: 32,
    memo: 'test with optional'
  }

  const encWith = c.encode(cstruct, testWith)
  t.same(c.decode(cstruct, encWith), testWith, 'with optional')

  const nested = {
    length: opt(array(c.uint)),
    nest: opt(cstruct)
  }

  const testNest = {
    nest: testWith
  }

  const nestenc = c.encode(compile(nested), testNest)

  const testExp = {
    length: null,
    ...testNest
  }
  t.same(c.decode(compile(nested), nestenc), testExp, 'nested')

  const testNestWith = {
    length: [32, 362, 217, 8329],
    nest: test
  }

  const nestencWith = c.encode(compile(nested), testNestWith)

  const testNestExp = {
    length: [32, 362, 217, 8329],
    nest: exp
  }
  t.same(testNestExp, c.decode(compile(nested), nestencWith), 'nested')

  t.end()
})

test('constant encoding', t => {
  const one = {
    type: constant(c.uint, 1),
    width: c.uint,
    memo: c.string
  }

  const two = {
    type: constant(c.string, '2'),
    width: c.uint,
    memo: c.string
  }

  const three = {
    type: constant(c.buffer, Buffer.alloc(1, 3)),
    width: c.uint,
    memo: c.string
  }

  const cone = compile(one)
  const ctwo = compile(two)
  const cthree = compile(three)

  const test = {
    width: 32,
    memo: 'test without optional'
  }

  const eone = c.encode(cone, test)
  const etwo = c.encode(ctwo, test)
  const ethree = c.encode(cthree, test)

  const exp1 = {
    type: 1,
    ...test
  }

  const exp2 = {
    type: '2',
    ...test
  }

  const exp3 = {
    type: Buffer.alloc(1, 3),
    ...test
  }

  t.same(c.decode(cone, eone), exp1, 'number')
  t.same(c.decode(ctwo, etwo), exp2, 'string')
  t.same(c.decode(cthree, ethree), exp3, 'buffer')

  const typed = {
    type: Buffer.alloc(32, 3),
    width: 32,
    memo: 'test without optional'
  }

  t.same(c.decode(cone, c.encode(cone, typed)).type, 1, 'with type already set')
  t.same(c.decode(ctwo, c.encode(ctwo, typed)).type, '2', 'with type already set')
  t.same(c.decode(cthree, c.encode(cthree, typed)).type, Buffer.alloc(1, 3),
    'with type already set')

  t.end()
})

test('header encoding', t => {
  const struct = compile({
    type: header(c.string),
    memo: header(c.string),
    width: c.uint,
    length: c.uint
  })

  const sheader = {
    type: 'memo!',
    memo: 'hello there!'
  }

  const test = {
    ...sheader,
    width: 32,
    length: 100
  }

  const estruct = c.encode(struct, test)
  const eheader = getHeader(estruct, { type: c.string, memo: c.string })

  t.same(c.decode(struct, estruct), test, 'header')
  t.same(eheader, sheader, 'get header')

  const nested = compile({
    memo: header(struct),
    width: c.uint,
    length: c.uint
  })

  const nestTest = {
    memo: test,
    width: 52,
    length: 47
  }

  const enested = c.encode(nested, nestTest)
  const nheader = getHeader(enested, { memo: struct })

  t.same(c.decode(nested, enested), nestTest, 'nested header')
  t.same(nheader.memo, test, 'nested get header')

  const orderTest = {
    width: 32,
    length: 100,
    ...sheader
  }

  const eorder = c.encode(struct, orderTest)
  const oheader = getHeader(eorder, { type: c.string, memo: c.string })

  t.same(c.decode(struct, eorder), orderTest, 'order header')
  t.same(oheader, sheader, 'order get header')

  t.end()
})

test('either encoding', t => {
  const struct = compile({
    message: either([c.string, c.buffer], b => {
      return b instanceof Uint8Array ? 1 : 0
    })
  })

  const stest = { message: 'hello' }
  const btest = { message: Buffer.from('world') }

  const sstruct = c.encode(struct, stest)
  const bstruct = c.encode(struct, btest)

  t.same(c.decode(struct, sstruct), stest, 'string')
  t.same(c.decode(struct, bstruct), btest, 'buffer')

  const estruct = compile({ type: constant(c.string, 'error'), message: c.string })
  const vstruct = compile({ type: constant(c.string, 'value'), value: c.buffer })

  const evstruct = either([estruct, vstruct], b => {
    return ['error', 'value'].indexOf(b.type)
  })

  const error = {
    type: 'error',
    message: 'encode me as a string'
  }

  const value = {
    type: 'value',
    value: Buffer.alloc(4, 1)
  }

  const etest = c.encode(evstruct, error)
  const vtest = c.encode(evstruct, value)

  t.same(c.decode(evstruct, etest), error, 'error')
  t.same(c.decode(evstruct, vtest), value, 'value')

  // test with strange encodings
  const hstruct = compile({
    type: header(c.string),
    memo: header(c.string),
    width: c.uint,
    length: c.uint
  })

  const hnested = compile({
    type: constant(c.string, 'header'),
    memo: header(hstruct),
    width: c.uint,
    length: c.uint
  })

  const hnest = {
    type: 'header',
    memo: {
      type: 'memo!',
      memo: 'hello there!',
      width: 32,
      length: 100
    },
    width: 52,
    length: 47
  }

  const onested = compile({
    type: constant(c.string, 'opt'),
    length: opt(array(c.uint)),
    nest: opt(compile({
      length: opt(c.uint),
      width: c.uint,
      memo: c.string
    }))
  })

  const onest = {
    type: 'opt',
    nest: {
      length: 32,
      width: 32,
      memo: 'test with optional'
    }
  }

  const oexp = {
    length: null,
    ...onest
  }

  const omnistruct = either([estruct, vstruct, hnested, onested], v => {
    return ['error', 'value', 'header', 'opt'].indexOf(v.type)
  })

  const htest = c.encode(omnistruct, hnest)
  const otest = c.encode(omnistruct, onest)

  t.same(c.decode(omnistruct, etest), error, 'error')
  t.same(c.decode(omnistruct, vtest), value, 'value')
  t.same(c.decode(omnistruct, htest), hnest, 'header')
  t.same(c.decode(omnistruct, otest), oexp, 'optional')

  t.end()
})
