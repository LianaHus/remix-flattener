function resolve(parentPath, childPath) {
	if (_isAbsolute(childPath)) {
		return childPath;
	}
	const path = parentPath + '/../' + childPath;
	const pathParts = path.split('/');
	const resolvedParts = _resolvePathArray(pathParts);
	const resolvedPath = resolvedParts
		.join('/')
		.replace('http:/', 'http://')
		.replace('https:/', 'https://');
	return resolvedPath;
}

function _isAbsolute(path) {
	return path[0] != '.';
}

function _resolvePathArray(parts) {
	let res = [];
	for (let i = 0; i < parts.length; i++) {
		let p = parts[i];

		// ignore empty parts
		if (!p || p === '.')
		continue;

		if (p === '..') {
			if (res.length && res[res.length - 1] !== '..') {
				res.pop();
			}
		} else {
			res.push(p);
		}
	}

	return res;
}
