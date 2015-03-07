function Index(buffer) {
	this.size = buffer.readUInt24BE(0);
	this.block = buffer.readUInt24BE(3);
}

module.exports = Index;