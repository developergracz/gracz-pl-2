import test from 'node:test';
import assert from 'node:assert/strict';
import {serveChessConsole} from '../auth/chess-console.mjs';

function load(path){
 let body='',status=0;
 serveChessConsole({method:'GET'},{writeHead(s){status=s;},end(s){body=s;}},new URL(path,'http://localhost'));
 return {body,status};
}
test('premium pieces are a local module with twelve opaque vector variants',async()=>{
 const asset=load('/konto/szachy/pieces.mjs');
 assert.equal(asset.status,200);
 const {createChessPiece,chessPieceLabel}=await import('data:text/javascript;base64,'+Buffer.from(asset.body).toString('base64'));
 const doc={createElementNS(ns,tag){return {ns,tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},append(...nodes){this.children.push(...nodes);}};}};
 const ids=new Set(),silhouettes=new Set();
 for(const piece of 'KQRBNPkqrbnp'){
  const svg=createChessPiece(doc,piece);
  assert.equal(svg.tag,'svg');assert.equal(svg.ns,'http://www.w3.org/2000/svg');
  assert.equal(svg.attrs['data-piece'],piece);
  assert.equal(svg.attrs['data-color'],piece===piece.toUpperCase()?'white':'black');
  assert.equal(svg.attrs.viewBox,'0 0 96 96');assert.equal(svg.attrs['aria-hidden'],'true');
  const nodes=[];const walk=n=>{nodes.push(n);n.children.forEach(walk);};walk(svg);
  const body=nodes.find(n=>n.attrs['data-body']==='true');
  assert.ok(body,'opaque silhouette required');assert.match(body.attrs.fill,/^url\(#/);
  assert.ok(!body.attrs.opacity&&!body.attrs['fill-opacity']);
  const gradient=nodes.find(n=>n.tag==='linearGradient');
  assert.ok(!ids.has(gradient.attrs.id));ids.add(gradient.attrs.id);
  assert.ok(gradient.children.every(n=>/^#[0-9a-f]{6}$/i.test(n.attrs['stop-color'])&&!n.attrs['stop-opacity']));
  assert.equal(gradient.children[1].attrs['stop-color'],piece===piece.toUpperCase()?'#ffffff':'#566674');
  silhouettes.add(body.attrs.d);
  assert.match(chessPieceLabel(piece),piece===piece.toUpperCase()?/^biał/:/^czarn/);
  assert.ok(nodes.every(n=>['svg','defs','linearGradient','stop','path','g'].includes(n.tag)));
 }
 assert.equal(silhouettes.size,6);assert.equal(ids.size,12);
 for(const invalid of ['.','',null,'<script>','constructor','toString']){
  assert.equal(createChessPiece(doc,invalid),null);assert.equal(chessPieceLabel(invalid),'puste');
 }
 assert.doesNotMatch(asset.body,/innerHTML|<text|<image|<filter/);
});
test('board and promotion use the local SVG renderer without chess fonts',()=>{
 const app=load('/konto/szachy/app.js').body,css=load('/konto/szachy/styl.css').body;
 assert.match(app,/import \{createChessPiece,chessPieceLabel\} from '\/konto\/szachy\/pieces.mjs'/);
 assert.match(app,/createChessPiece\(document,p\)/);
 assert.match(app,/button.append\(createChessPiece\(document,state.t/);
 assert.doesNotMatch(app,/[♜♞♝♛♚♟]/);
 assert.doesNotMatch(css,/Segoe UI Symbol|text-fill-color|text-stroke/);
});
