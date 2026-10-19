// Static AST traversal only: never execute production code while auditing imports.
import {parse} from 'acorn';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isBuiltin} from 'node:module';

export async function auditProductionImports(entry,{
  read=url=>readFile(url,'utf8'),
  canonical=async url=>pathToFileURL(await realpath(fileURLToPath(url))),
}={}) {
  const root=new URL('./',entry),visited=new Set();
  async function visit(input){
    const url=await canonical(input),path=fileURLToPath(url);
    if(!url.href.startsWith(root.href)||/(?:^|\/)(?:tests?|__tests__|test-support|integration|fixtures?)\//.test(path)||
      (/\/(?:newsletter|newsletter-status)\.mjs$/.test(path)||/\.(?:test|spec)\.mjs$/.test(path)))throw new Error('Forbidden production import: '+path);
    if(visited.has(path))return;
    visited.add(path);
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
      if(isBuiltin(specifier)||specifier==='pg')continue;
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))throw new Error('Unreviewed production dependency: '+specifier);
      await visit(new URL(specifier,url));
    }
  }
  await visit(entry);
  return [...visited];
}
