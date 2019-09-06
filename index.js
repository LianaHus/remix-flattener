const { createIframeClient } = remixPlugin;
const client = createIframeClient();

const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+).*$/gm;

async function init() {
	await client.onload();
	console.log(client);
	client.on('solidity', 'compilationFinished', (file, source, languageVersion, data) => {
		fileName = file
		latestCompilationResult = { data, source }
		console.log('compilationFinished', fileName, latestCompilationResult);
	});
}

async function flatten() {
	await client.onload();
	const compilationResult = await client.call('solidity', 'getCompilationResult');
	if (!compilationResult) throw new Error('no compilation result available');
	const target = compilationResult.source.target;
	const ast = compilationResult.data.sources;
	const sources = compilationResult.source.sources;
	const dependencyGraph = _getDependencyGraph(ast, target);
	const sortedFiles = dependencyGraph.isEmpty()
		? [ target ]
		: dependencyGraph.sort().reverse();
	const uniqueFiles = _unique(sortedFiles);
	const flattenedSources = _concatSourceFiles(sortedFiles, sources);
	_updateInput(flattenedSources);
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

function _updateInput(text) {
	const input = document.getElementById('code');
	input.value = text;
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
