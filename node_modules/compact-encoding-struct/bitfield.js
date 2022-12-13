const c = require('compact-encoding')

module.exports = {
  preencode (state, bits = [], prev) {
    c.uint.preencode(state, bitsToNumberLE(bits))
  },
  encode (state, bits = []) {
    const num = bitsToNumberLE(bits)
    c.uint.encode(state, num)
  },
  decode (state) {
    const num = c.uint.decode(state)
    return numberToBitsLE(num)
  }
}

function bitsToNumberLE (bits) {
  let num = 0
  for (let i = 0; i < bits.length; i++) {
    num |= bits[i] << i
  }
  return num
}

function numberToBitsLE (num) {
  const bits = []
  while (num > 0) {
    bits.push(num & 1)
    num >>>= 1
  }
  return bits
}
