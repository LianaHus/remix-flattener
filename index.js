const { createIframeClient } = remixPlugin;
const client = createIframeClient();

const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+).*$/gm;

let filePath;
let compilationResult;
let flattenedSources;

async function init() {
	await client.onload();
	client.on('solidity', 'compilationFinished', (file, source, languageVersion, data) => {
		client.emit('statusChanged', { key: 'none' })
		_updateFlattenButton(file);
		filePath = file;
		compilationResult = { data, source };
	});
}

async function flatten() {
	// Get input
	const target = compilationResult.source.target;
	const ast = compilationResult.data.sources;
	const sources = compilationResult.source.sources;
	// Process
	const dependencyGraph = _getDependencyGraph(ast, target);
	const sortedFiles = dependencyGraph.isEmpty()
		? [ target ]
		: dependencyGraph.sort().reverse();
	const uniqueFiles = _unique(sortedFiles);
	flattenedSources = _concatSourceFiles(sortedFiles, sources);
	// Update UI
	client.emit('statusChanged', { key: 'succeed', type: 'success', title: 'Contract flattened' })
	_showAlert('Flattened contract copied to clipboard');
	_updateSaveButton(target);
	// Save to clipboard
	navigator.clipboard.writeText(flattenedSources);
}

async function save() {
	await _saveFile(filePath, flattenedSources);
	client.emit('statusChanged', { key: 'succeed', type: 'success', title: 'File saved' })
	_showAlert('File saved');
}

function _updateFlattenButton(filePath) {
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
		concat += `\n// File: ${file}\n\n`;
		concat += sourceWithoutImport;
	}
	return concat;
}

function _showAlert(message) {
	const alertContainer = document.getElementById('alerts');
	const alert = document.createElement('div');
	alert.innerText = message;
	alert.classList.add('alert');
	alert.classList.add('alert-success');
	alertContainer.appendChild(alert);
	setTimeout(() => {
		alertContainer.removeChild(alert);
	}, 5000);
}

function _updateSaveButton(filePath) {
	const button = document.getElementById('save');
	const filePathTokens = filePath.split('/');
	const fileNameWithExtension = filePathTokens[filePathTokens.length - 1];
	const fileNameTokens = fileNameWithExtension.split('.');
	const fileName = fileNameTokens[0];
	const flattenedFilePath = `${fileName}_flat.sol`;
	button.disabled = false;
	button.title = '';
	button.innerText = `Save as ${flattenedFilePath}`;
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
