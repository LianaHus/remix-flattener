const { createIframeClient } = remixPlugin;
const client = createIframeClient();

const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+).*$/gm;

let compilationResult;

async function init() {
	await client.onload();
	client.on('solidity', 'compilationFinished', (file, source, languageVersion, data) => {
		client.emit('statusChanged', { key: 'none' })
		_updateButton(file);
		compilationResult = { data, source };
	});
}

async function flatten() {
	const target = compilationResult.source.target;
	const ast = compilationResult.data.sources;
	const sources = compilationResult.source.sources;
	const dependencyGraph = _getDependencyGraph(ast, target);
	const sortedFiles = dependencyGraph.isEmpty()
		? [ target ]
		: dependencyGraph.sort().reverse();
	const uniqueFiles = _unique(sortedFiles);
	const flattenedSources = _concatSourceFiles(sortedFiles, sources);
	client.emit('statusChanged', { key: 'succeed', type: 'success', title: 'Contract flattened' })
	_showAlert();
	navigator.clipboard.writeText(flattenedSources);
	_saveFile(target, flattenedSources);
}

function _updateButton(filePath) {
	const button = document.getElementById('action');
	const filePathTokens = filePath.split('/');
	const fileName = filePathTokens[filePathTokens.length - 1];
	button.disabled = false;
	button.title = '';
	button.innerText = `Flatten ${fileName}`;
}

function _getDependencyGraph(ast, target) {
	const graph = tsort();
	const visited = {};
	visited[target] = 1;
	_traverse(graph, visited, ast, target);
	return graph;
}

function _unique(array) {
	return [...new Set(array)];
}

function _concatSourceFiles(files, sources) {
	let concat = '';
	for (const file of files) {
		const source = sources[file].content;
		const sourceWithoutImport = source.replace(IMPORT_SOLIDITY_REGEX, '');
		concat += `// File: ${file}\n\n`;
		concat += sourceWithoutImport;
		concat += '\n\n';
	}
	return concat;
}

function _showAlert() {
	const alertContainer = document.getElementById('alerts');
	const alert = document.createElement('div');
	alert.innerText = 'Contract flattened';
	alert.classList.add('alert');
	alert.classList.add('alert-success');
	alertContainer.appendChild(alert);
	setTimeout(() => {
		alertContainer.removeChild(alert);
	}, 5000);
}
async function _saveFile(filePath, text) {
	const filePathTokens = filePath.split('/');
	const fileNameWithExtension = filePathTokens[filePathTokens.length - 1];
	const fileNameTokens = fileNameWithExtension.split('.');
	const fileName = fileNameTokens[0];
	const flattenedFilePath = `browser/${fileName}_flat.sol`;
	await client.fileManager.setFile(flattenedFilePath, text);
}

function _traverse(graph, visited, ast, name) {
	const currentAst = ast[name].ast;
	const dependencies = _getDependencies(currentAst);
	for (const dependency of dependencies) {
		const path = resolve(name, dependency);
		if (path in visited) {
			continue;
		}
		visited[path] = 1;
		graph.add(name, path);
		_traverse(graph, visited, ast, path);
	}
}

function _getDependencies(ast) {
	const dependencies = ast.nodes
		.filter(node => node.nodeType == 'ImportDirective')
		.map(node => node.file);
	return dependencies;
}

init();
