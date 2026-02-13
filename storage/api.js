'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const mkdirp = require('mkdirp');

const values = require('../values');

let storage;
let parent;

function getDataDir(appName) {
	const homedir = os.homedir();
	const platform = process.platform;

	if(platform === 'darwin') {
		return path.join(homedir, 'Library', 'Application Support', appName);
	} else if(platform === 'win32') {
		const appData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
		return path.join(appData, appName, 'Data');
	} else {
		const xdgData = process.env.XDG_DATA_HOME || path.join(homedir, '.local', 'share');
		return path.join(xdgData, appName);
	}
}

function resolveDataDir() {
	if(! parent) {
		if(process.env.THING_STORAGE) {
			parent = process.env.THING_STORAGE;
		} else {
			parent = getDataDir('abstract-things');
		}

		mkdirp.sync(parent);
	}

	return parent;
}

class FileStorage {
	constructor(opts) {
		this._path = opts.path;
	}

	_keyPath(key) {
		return path.join(this._path, key + '.json');
	}

	get(key) {
		const filePath = this._keyPath(key);
		return fs.promises.readFile(filePath, 'utf8')
			.then(data => JSON.parse(data))
			.catch(err => {
				if(err.code === 'ENOENT') return undefined;
				throw err;
			});
	}

	set(key, value) {
		const filePath = this._keyPath(key);
		const dir = path.dirname(filePath);
		return fs.promises.mkdir(dir, { recursive: true })
			.then(() => fs.promises.writeFile(filePath, JSON.stringify(value), 'utf8'));
	}
}

function resolveStorage() {
	if(storage) return storage;

	let parent = resolveDataDir();
	const p = path.join(parent, 'storage');
	mkdirp.sync(p);

	storage = new FileStorage({
		path: p
	});
	return storage;
}

class SubStorage {
	constructor(storage, sub) {
		this._storage = storage;
		this._path = sub;
	}

	get(key, type='mixed') {
		return this._storage.get(this._path + '/' + key)
			.then(json => values.fromJSON(type, json));
	}

	set(key, value, type='mixed') {
		return this._storage.set(this._path + '/' + key, values.toJSON(type, value));
	}

	sub(key) {
		return new SubStorage(this._storage, this._path + '/' + key);
	}

	inspect() {
		return 'Storage[' + this._path + ']';
	}

	toString() {
		return this.inspect();
	}
}

module.exports = {
	get dataDir() {
		return resolveDataDir();
	},

	global() {
		return new SubStorage(resolveStorage(), 'global');
	},

	instance(id) {
		return new SubStorage(resolveStorage(), 'instance/' + id);
	}
};
