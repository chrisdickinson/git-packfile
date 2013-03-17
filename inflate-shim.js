var zlib = require('zlib')

module.exports = function(buf, ready) {
  var input = new Uint8Array(buf.length)

  for(var i = 0, len = input.length; i < len; ++i) {
    input[i] = buf.get(i)
  }

  var result = zlib.inflateSync(input)
    , output = new Buffer(result.length)

  for(var i = 0, len = result.length; i < len; ++i) {
    output.writeUInt8(result[i], i)
  }

  ready(null, output)
}
