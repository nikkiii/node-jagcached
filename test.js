var IndexedFileSystem = require('./jagcache/IndexedFileSystem.js'),
	Archive = require('./jagcache/Archive.js');

var fs = new IndexedFileSystem('cache');

// TODO Archive decoding is broken due to the bzip2 implementation not working correctly.

fs.getFile(0, 5, function(buffer) {
	var archive = new Archive(buffer);

	console.log('File: ', archive.getEntry("anim_crc"));
});