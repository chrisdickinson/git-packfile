# git-packfile

read object data out of git packfiles, applying
ofs/ref deltas and zlib decompression.

[![Build Status](https://travis-ci.org/chrisdickinson/git-packfile.png)](https://travis-ci.org/chrisdickinson/git-packfile)
[![browser support](http://ci.testling.com/chrisdickinson/git-packfile.png)](http://ci.testling.com/chrisdickinson/git-packfile)

```javascript
var packfile = require('git-packfile')
  , idxparse = require('git-packidx-parser')

fs.createReadStream('path/to/idx')
  .pipe(idxparse())
  .on('data', next)

function next(packIndex) {
  var pack = packfile(
        fs.statSync('path/to/packfile')
      , lookup
      , readStream
  )

  lookup(<some git hash as a buffer>, function(err, object) {
    // obj === {type: git type number, data: buffer}
  })

  function readStream(start, end) {
    return fs.createReadStream('path/to/packfile', {
      start: start
    , end: end
    })
  }

  function lookup(oid, ready) {
    var location = packIndex.find(oid)
    pack.read(location.offset, location.next, ready)
  }
} 

```

## API

#### packfile(size, lookupRef, createReadStream) -> Packfile instance

create a packfile instance. all arguments are required.

`lookupRef` should be a function that takes a buffer instance and a callback,
and calls that callback with the results of searching for that hash against all
available object databases. 

`createReadStream` is a function that takes a byte start and end, and should
return a readable stream object.

#### Packfile#read(offset, nextOffset, ready)

Read from offset until nextOffset (given by [the pack index](http://npm.im/git-packidx-parser)), and calls `ready` with the result.

Returned objects look like so:

```javascript
{ type: <integer git object type>
, data: <Buffer> }
```

The data is decompressed and has all deltas already applied to it.

## License

MIT
