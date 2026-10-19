// Static AST traversal only: never execute production code while auditing imports.
import {parse} from 'acorn';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {productionModules,productionDependencies} from './production-import-manifest.mjs';

export async function auditProductionImports(entry,{
  read=url=>readFile(url,'utf8'),
  canonical=async url=>pathToFileURL(await realpath(fileURLToPath(url))),
}={}) {
  if(entry.protocol!=='file:'||entry.search||entry.hash)throw new Error('Invalid production entry');
  const directory=await canonical(new URL('./',entry));
  if(directory.protocol!=='file:')throw new Error('Invalid production root');
  const root=new URL(directory.href.replace(/\/?$/, '/'));
  const allowed=new Set(productionModules.map(path=>new URL(path,root).href));
  const dependencies=new Set(productionDependencies),visited=new Set();
  async function visit(input){
    if(!allowed.has(input.href))throw new Error('Unreviewed production module');
    const url=await canonical(input);
    // A checkout directory may be symlinked, but an allowed filename cannot alias
    // a different file. URL membership is independent of host path separators.
    if(url.href!==input.href||!allowed.has(url.href))throw new Error('Forbidden production module alias');
    if(visited.has(url.href))return;
    visited.add(url.href);
    const tree=parse(await read(url),{ecmaVersion:'latest',sourceType:'module'}),edges=[];
    function walk(node){
      if(!node||typeof node!=='object')return;
      let source;
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type))source=node.source;
      if(node.type==='ImportExpression')source=node.source;
      if(source){
        if(source.type!=='Literal'||typeof source.value!=='string')throw new Error('Computed production import');
        edges.push(source.value);
      }
      if(node.type==='Identifier'&&['require','createRequire','eval'].includes(node.name))throw new Error('Untracked module-loading mechanism');
      for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
    }
    walk(tree);
    for(const specifier of edges){
      if(dependencies.has(specifier))continue;
      if(/[\\%?#]/.test(specifier))throw new Error('Ambiguous production specifier');
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw new Error('Unreviewed production dependency: '+specifier);
      await visit(new URL(specifier,url));
    }
  }
  await visit(new URL(entry.pathname.split('/').at(-1),root));
  return [...visited].map(url=>fileURLToPath(url));
}
