// TODO we need a bzip2 implementation that supports the older version the jagex cache uses.

function ArchiveEntry(identifier, buffer) {
	this.identifier = identifier;
	this.buffer = buffer;
}

function Archive(buffer) {
	var extractedSize = buffer.readUInt24BE(0);
	var size = buffer.readUInt24BE(3);
	var extracted = false, idx = 6;

	if (size != extractedSize) {
		buffer = this.decompressBzip(idx, size, buffer);
		idx += size;
		extracted = true;
	}

	var entries = buffer.readUInt16BE(idx);
	var identifiers = [];
	var extractedSizes = [];
	var sizes = [];

	idx += 2;

	for (var i = 0; i < entries; i++) {
		identifiers.push(buffer.readUInt16BE(idx));
		extractedSizes.push(buffer.readUInt24BE(idx + 4));
		sizes.push(buffer.readUInt24BE(idx + 7));
		idx += 10;
	}

	var entry = [];

	for (var i = 0; i < entries; i++) {
		var data = false;
		if (!extracted) {
			data = this.decompressBzip(idx, sizes[i], buffer); // TODO: Deflate.
			idx += sizes[i];
		} else {
			data = buffer.slice(idx, idx + extractedSizes[i]);
			idx += extractedSizes[i];
		}
		entry.push(new ArchiveEntry(identifiers[i], data));
	}

	this.entries = entry;
}

Archive.prototype.getEntry = function(name) {
	var hash = 0;
	name = name.toUpperCase();
	for (var i = 0; i < name.length(); i++) {
		hash = (hash * 61 + name.charAt(i)) - 32;
	}
	for (var i = 0; i < this.entries.length; i++) {
		if (this.entries[i].identifier == hash) {
			return this.entries[i];
		}
	}
	throw "Not Found";
};

Archive.prototype.decompressBzip = function(idx, data, size) {
	var compressed = new Buffer(4 + size);
	compressed.write("BZh");
	compressed.writeUInt8(1 + 0x30, 3);
	data.copy(compressed, 4, idx, idx + size);

	// TODO decompress.

	return compressed;
};

module.exports = Archive;