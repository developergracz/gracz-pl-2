import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../../maintenance-site/assets/home-owner-next-approved-20261122.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../../maintenance-site/index.html',import.meta.url),'utf8');

test('Nasze gry navigation keeps heading below sticky menu on desktop and mobile',()=>{
 assert.match(html,/href="#nasze-gry" class="r4-btn r4-btn-gold">Nasze gry<\/a>/);
 assert.match(css,/#nasze-gry \{\s*scroll-margin-top: 190px !important;/);
 assert.match(css,/@media \(max-width: 760px\) \{\s*#public-portal\[data-page='home'\] #nasze-gry \{\s*scroll-margin-top: 96px !important;/);
 assert.match(html,/home-owner-next-approved-20261122\.css\?v=games-anchor-r927/);
});
