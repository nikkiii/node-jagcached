var IndexedFileSystem = require('./jagcache/IndexedFileSystem.js'),
	JaggrabServer = require('./servers/jaggrab.js'),
	OnDemandServer = require('./servers/ondemand.js');

var fs = new IndexedFileSystem('cache');

var jaggrab = new JaggrabServer(fs);
jaggrab.listen(43595);

var ondemand = new OnDemandServer(fs);
ondemand.listen(43594);