module.exports = packfile

var parse = require('./parse')

function packfile(size, find_raw, read) {
  return new Packfile(size, find_raw, read)
}

function Packfile(size, find_raw, read) {
  this._size = size
  this._find_raw = find_raw
  this._read = read
}

var cons = Packfile
  , proto = cons.prototype

proto.constructor = cons

proto.read = function(idxoffset, next_idxoffset, ready) {
  next_idxoffset = next_idxoffset || this._size - 20

  this._read(idxoffset, next_idxoffset)
    .pipe(parse(this, idxoffset, next_idxoffset))
    .on('error', function(err) {
      ready(err)
    })
    .on('data', function(object) {
      ready(null, object)
    })
}
