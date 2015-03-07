var fs = require('fs');
var crc32 = require('buffer-crc32');

// TODO this entire file needs to be redone with proper exceptions.

var FileSystemConstants = require('./FileSystemConstants.js');
var Index = require('./Index.js');

Buffer.prototype.readUInt24BE = function(index) {
	return (this.readUInt8(index) << 16) + (this.readUInt8(index + 1) << 8) + this.readUInt8(index + 2);
};

Buffer.prototype.writeUInt24BE = function(value, index) {
	this.writeUInt8(value >> 16, index);
	this.writeUInt8(value >> 8, index + 1);
	this.writeUInt8(value & 0xff, index + 2);
};

function IndexedFileSystem(path, readOnly) {
	this.path = path;
	this.readOnly = readOnly;
	this.indices = {};

	this.detectLayout();
}

IndexedFileSystem.prototype.detectLayout = function() {
	var indexCount = 0;
	for (var i = 0; i < 256; i++) {
		var file = this.path + '/main_file_cache.idx' + i;
		if (fs.existsSync(file)) {
			indexCount++;
			this.indices[i] = {
				size: fs.statSync(file).size,
				file : fs.openSync(file, 'r')
			};
		}
	}
	if (indexCount <= 0) {
		throw new Error("No index file(s) present");
	}

	this.data = fs.openSync(this.path + '/main_file_cache.dat', 'r');
};

IndexedFileSystem.prototype.getFileCount = function(type) {
	if (!(type in this.indices)) {
		throw new Error("Out of bounds");
	}

	return this.indices[type].size / FileSystemConstants.INDEX_SIZE;
};

IndexedFileSystem.prototype.getIndex = function(index, file, callback) {
	if (!(index in this.indices)) {
		callback(false);
		return;
	}
	var indexFile = this.indices[index].file;

	var ptr = file * FileSystemConstants.INDEX_SIZE;

	if (ptr >= 0 && this.indices[index].size >= ptr + FileSystemConstants.INDEX_SIZE) {
		var buffer = new Buffer(FileSystemConstants.INDEX_SIZE);

		fs.read(indexFile, buffer, 0, FileSystemConstants.INDEX_SIZE, ptr, function(err, bytesRead, buffer) {
			if (err) {
				callback(false);
				return;
			}
			callback(new Index(buffer));
		});
	} else {
		throw "";
	}
};

IndexedFileSystem.prototype.getFile = function(indexId, file, callback) {
	var self = this;
	this.getIndex(indexId, file, function(index) {
		if (!index) {
			callback(false);
			return;
		}
		var buffer = new Buffer(index.size);

		// calculate some initial values
		var ptr = index.block * FileSystemConstants.BLOCK_SIZE;
		var read = 0;
		var size = index.size;
		var blocks = Math.floor(size / FileSystemConstants.CHUNK_SIZE);

		if (size % FileSystemConstants.CHUNK_SIZE != 0) {
			blocks++;
		}


		for (var i = 0; i < blocks; i++) {
			// read header
			var header = new Buffer(FileSystemConstants.HEADER_SIZE);

			// TODO make this read without using sync? We can read more than the header.
			fs.readSync(self.data, header, 0, FileSystemConstants.HEADER_SIZE, ptr);

			// increment pointers
			ptr += FileSystemConstants.HEADER_SIZE;

			// parse header
			var nextFile = header.readUInt16BE(0);
			var curChunk = header.readUInt16BE(2);
			var nextBlock = header.readUInt24BE(4);
			var nextType = header.readUInt8(7);

			// check expected chunk id is correct
			if (i != curChunk) {
				callback(new Error("Chunk id mismatch."));
				return;
			}

			// calculate how much we can read
			var chunkSize = size - read;
			if (chunkSize > FileSystemConstants.CHUNK_SIZE) {
				chunkSize = FileSystemConstants.CHUNK_SIZE;
			}

			fs.readSync(self.data, buffer, read, chunkSize, ptr);

			// increment pointers
			read += chunkSize;
			ptr = nextBlock * FileSystemConstants.BLOCK_SIZE;

			// if we still have more data to read, check the validity of the
			// header
			if (size > read) {
				if (nextType != (indexId + 1)) {
					callback(new Error("File type mismatch."));
					return;
				}

				if (nextFile != file) {
					callback(new Error("File id mismatch."));
					return;
				}
			}
		}

		callback(null, buffer);
	});
};

IndexedFileSystem.prototype.getCrcTable = function(callback) {
	if (this.crcTable) {
		callback(this.crcTable);
		return;
	}

	var self = this;

	// the number of archives
	var archives = this.getFileCount(0);

	// the hash
	var hash = 1234;

	function getFile(index, crcs, finished) {
		self.getFile(0, index, function(err, buffer) {
			if (err) {
				return;
			}
			crcs[index] = crc32.signed(buffer);
			finished();
		});
	}

	function calculateCRCs(callback) {
		var crcs = {};
		var waiting = archives - 1;
		var finished = function() {
			waiting--;
			if (waiting <= 0) {
				callback(crcs);
			}
		};
		// calculate the CRCs
		for (var i = 1; i < archives; i++) {
			getFile(i, crcs, finished);
		}
	}

	calculateCRCs(function(crcs) {
		crcs[0] = 0;
		var buffer = new Buffer(archives * 4 + 4);

		var idx = 0;
		for (var i = 0; i < archives; i++) {
			hash = (hash << 1) + crcs[i];
			buffer.writeInt32BE(crcs[i], idx++ * 4);
		}

		buffer.writeUInt32BE(hash, idx * 4);

		self.crcTable = buffer;

		callback(buffer);
	});
};

module.exports = IndexedFileSystem;