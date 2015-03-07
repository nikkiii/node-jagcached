var net = require('net');

String.prototype.startsWith = function(str) {
	return this.indexOf(str) == 0;
};

function JaggrabServer(fs, port) {
	this.fs = fs;
}

JaggrabServer.prototype.listen = function(port) {
	var self = this;
	this.server = net.createServer(function(socket) {
		self.connection(socket);
	});
	this.server.listen(port);
	console.log('Listening on port ' + port);
};

JaggrabServer.prototype.connection = function(socket) {
	var self = this;
	socket.on('error', function() {});
	socket.on('data', function(data) {
		data = data.toString("UTF-8");

		if (data.indexOf("JAGGRAB /") == 0) {
			self.handleRequest(socket, data.substring(8));
		}
	});
};

JaggrabServer.prototype.handleRequest = function(socket, path) {
	if (path.startsWith("/crc")) {
		this.fs.getCrcTable(function(crc) {
			socket.write(crc);
		});
	} else if (path.startsWith("/title")) {
		this.sendResponse(socket, 1);
	} else if (path.startsWith("/config")) {
		this.sendResponse(socket, 2);
	} else if (path.startsWith("/interface")) {
		this.sendResponse(socket, 3);
	} else if (path.startsWith("/media")) {
		this.sendResponse(socket, 4);
	} else if (path.startsWith("/versionlist")) {
		this.sendResponse(socket, 5);
	} else if (path.startsWith("/textures")) {
		this.sendResponse(socket, 6);
	} else if (path.startsWith("/wordenc")) {
		this.sendResponse(socket, 7);
	} else if (path.startsWith("/sounds")) {
		this.sendResponse(socket, 8);
	}
};

JaggrabServer.prototype.sendResponse = function(socket, index) {
	this.fs.getFile(0, index, function(buffer) {
		socket.write(buffer);
	});
};

module.exports = JaggrabServer;