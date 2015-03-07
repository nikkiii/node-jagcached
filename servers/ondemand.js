var net = require('net'),
	binary = require('binary');

var CHUNK_LENGTH = 500;

/**
 * Construct a new OnDemand Server
 *
 * @param fs The FileSystem instance.
 * @constructor
 */
function OnDemandServer(fs) {
	this.fs = fs;
}

/**
 * Listen on a specific port for requests.
 *
 * @param port The port to listen on.
 */
OnDemandServer.prototype.listen = function(port) {
	var handshake = new Buffer(8);
	handshake.writeUInt32BE(0, 0);
	handshake.writeUInt32BE(0, 4);

	var self = this;
	this.server = net.createServer(function(socket) {
		var service = -1;

		socket.on('error', function() {});

		var b = binary()
			.loop(function(end, vars) {
				this.word8u('type')
					.word16bu('file')
					.word8u('priority')
					.tap(function(data) {
						// Increment type by 1 internally
						data.type++;

						self.handleRequest(socket, data.type, data.file, data.priority);
					});
			});

		socket.on('data', function(data) {
			if (service == -1) {
				service = data.readUInt8(0);

				if (service != 15) {
					socket.end();
					return;
				} else {
					socket.write(handshake);
				}

				socket.pipe(b);
			}
		});
	});
	this.server.listen(port);
};

/**
 * Handle a request and respond with the file data.
 *
 * @param socket The socket the request originated from.
 * @param type The indice to read from.
 * @param file The file to read from.
 * @param priority The request priority.
 */
OnDemandServer.prototype.handleRequest = function(socket, type, file, priority) {
	this.fs.getFile(type, file, function(buffer) {
		if (!buffer) {
			socket.end();
			return;
		}
		var remaining = buffer.length;
		var length = buffer.length;

		var chunks = Math.floor(buffer.length / CHUNK_LENGTH);

		if (buffer.length % CHUNK_LENGTH != 0) {
			chunks++;
		}

		for (var chunk = 0; chunk < chunks; chunk++) {
			var chunkSize = remaining;
			if (chunkSize > CHUNK_LENGTH) {
				chunkSize = CHUNK_LENGTH;
			}

			var res = new Buffer(7 + chunkSize);

			res.writeUInt8(type - 1, 0);
			res.writeUInt16BE(file, 1);
			res.writeUInt24BE(length, 3);
			res.writeUInt8(chunk, 6);

			buffer.copy(res, 7, chunk * CHUNK_LENGTH, (chunk * CHUNK_LENGTH) + chunkSize);

			socket.write(res);

			remaining -= chunkSize;
		}
	});
};

module.exports = OnDemandServer;