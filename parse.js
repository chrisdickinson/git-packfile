module.exports = parse

var through = require('through')
  , inflate = require('./inflate')
  , apply_delta = require('git-apply-delta')
  , Buffer = require('buffer').Buffer

var _ = 0
  , STATE_INITIAL_BYTE = _++
  , STATE_EXPANDED_SIZE = _++
  , STATE_PAYLOAD = _++

var OFS_DELTA = 6
  , REF_DELTA = 7

function parse(packfile, idx_offset, next_idx_offset) {
  var stream = through(write, end)
    , state = STATE_INITIAL_BYTE
    , payload_accum = []
    , expanded_size = []
    , payload_size = 0
    , size
    , type

  return stream

  function write(buf) {
    var offset = 0
      , len = buf.length
      , byt

    if(state === STATE_INITIAL_BYTE) {
      byt = buf.readUInt8(0)
      type = byt >> 4 & 7
      expanded_size[expanded_size.length] = byt & 0x0F
      ++offset

      if(byt & 0x80) {
        state = STATE_EXPANDED_SIZE
      } else {
        size = byt & 0x0F
        state = STATE_PAYLOAD
      }
    }

    if(state === STATE_EXPANDED_SIZE && offset < len) {
      var plain =[]
      do {
        byt = buf.readUInt8(offset++)
        plain[plain.length] = byt
        expanded_size[expanded_size.length] = byt & 0x7F
      } while(offset < len && byt & 0x80)

      if(offset === len && (byt & 0x80)) {
        return
      }

      var num_bytes = expanded_size.length
      size = expanded_size.pop()
      while(expanded_size.length) {
        size |= expanded_size.pop() << (4 + (7 * (num_bytes - expanded_size.length)))
      }

      state = STATE_PAYLOAD
    }

    if(state === STATE_PAYLOAD && offset < len) {
      if(offset === 0) {
        payload_accum[payload_accum.length] = buf
        payload_size += buf.length
      } else {
        payload_accum[payload_accum.length] = buf.slice(offset)
        payload_size += len - offset
      }
    }
  }

  function end() {
    // well super great.
    if(state !== STATE_PAYLOAD) {
      return stream.emit('error', new Error('unexpected end of object'))
    }

    if(type < 4) {
      do_inflate()
    } else if(type === OFS_DELTA) {
      do_ofs_delta()
    } else if(type === REF_DELTA) {
      do_ref_delta()
    } else {
      return stream.emit('error', new Error('unknown object type: ' + type))
    }
  }

  function do_inflate() {
    var buf = Buffer.concat(payload_accum, payload_size)
    inflate(buf, function(err, data) {
      if(err) {
        return stream.emit('error', err)
      }
      stream.queue({
        type: type
      , data: data
      })
      stream.queue(null)
    })
  }

  function do_ofs_delta() {
    var buf = Buffer.concat(payload_accum, payload_size)
      , _byte = buf.readUInt8(0)
      , offset = _byte & 0x7F
      , target_object
      , idx = 1

    while(_byte & 0x80) {
      offset += 1
      offset <<= 7
      _byte = buf.readUInt8(idx++)
      offset += _byte & 0x7F
    }

    // TODO: this doesn't take 
    // big offsets into account.
    // should it?
    return packfile.read(idx_offset - offset, idx_offset, onread)

    // TODO: these could be done
    // in parallel.

    function onread(err, _target_object) {
      if(err) {
        return stream.emit('error', err)
      }

      target_object = _target_object

      inflate(buf.slice(idx), ondelta)
    } 

    function ondelta(err, delta) {
      var new_data = apply_delta(delta, target_object.data)

      stream.queue({
        type: target_object.type
      , data: new_data
      })
      stream.queue(null)
    }
  }

  function do_ref_delta() {
    var buf = Buffer.concat(payload_accum, payload_size)
      , target_oid = buf.slice(0, 20)
      , delta

    buf = buf.slice(20)

    return inflate(buf, ondelta)

    // TODO: these could be done in
    // parallel.

    function ondelta(err, _delta) {
      if(err) {
        return stream.emit('error', err)
      }

      delta = _delta
      packfile._find_raw(target_oid, ontarget) 
    }

    function ontarget(err, target) {
      var out

      out = apply_delta(delta, target.data)
      stream.queue({
          type: target.type
        , data: out
      })
      stream.queue(null)
    }
  } 
}
