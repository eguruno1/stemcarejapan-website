import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
// Small DOM fixture for quote behavior; no browser dependency or network requests.
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.listeners={}; this.dataset={}; this.value=''; this.attrs={}; this.hidden=false; this.classes=new Set(); this.classList={toggle:(c,on)=>{on??=!this.classes.has(c);on?this.classes.add(c):this.classes.delete(c);return on;},remove:c=>this.classes.delete(c)}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  querySelectorAll(tag) { return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]); }
  addEventListener(event,fn) { (this.listeners[event]??=[]).push(fn); }
  async fire(event) { for(const fn of this.listeners[event]||[]) await fn({preventDefault(){},key:'Escape'}); }
  setAttribute(k,v) { this.attrs[k]=v; }
  focus() {} select() {}
}
const ids=Object.fromEntries(['quote-form','service','service-fields','form-status','quote-output','menu-toggle','navigation'].map(id=>[id,new Element()]));
const form=ids['quote-form'], service=ids.service;
service.value='airport';
const option={textContent:'仁川・金浦空港送迎'}; service.selectedOptions=[option];
form.elements=Object.fromEntries(['date','name','email','people','message'].map(n=>[n,new Element('input')]));
Object.assign(form.elements.date,{value:'2030-10-01'});form.elements.name.value='山田 & Kim';form.elements.email.value='test@example.com';form.elements.people.value='4';form.elements.message.value='A & B? <hello>';
let valid=true; form.reportValidity=()=>valid;
const buttons=['ja','ko'].map(language=>{const e=new Element('button');e.dataset.language=language;return e;});
const translated=new Element('span');translated.dataset={ja:'日本語',ko:'한국어'};
const document={documentElement:{},getElementById:id=>ids[id],createElement:tag=>new Element(tag),addEventListener(){},querySelectorAll:s=>s==='[data-language]'?buttons:[translated,...ids['service-fields'].querySelectorAll('span')]};
ids['copy-quote']=new Element('button');
let copied='';
const context={document,window:{location:{href:''}},localStorage:{getItem(){return null;},setItem(){}},navigator:{clipboard:{async writeText(t){copied=t;}}},Date,FormData:class {constructor(){this.data={...Object.fromEntries(Object.entries(form.elements).map(([n,e])=>[n,e.value])),...Object.fromEntries(ids['service-fields'].querySelectorAll('input').map(e=>[e.name,e.value]))};}get(n){return this.data[n];}},console};
vm.runInNewContext(fs.readFileSync(new URL('../js/travel.js',import.meta.url),'utf8'),context);
assert.equal(ids['service-fields'].querySelectorAll('input').length,3);
ids['service-fields'].querySelectorAll('input')[0].value='仁川';
await buttons[1].fire('click'); assert.equal(document.documentElement.lang,'ko');assert.equal(translated.textContent,'한국어');assert.equal(ids['service-fields'].querySelectorAll('input')[0].value,'仁川');
service.value='business';await service.fire('change');assert.deepEqual(ids['service-fields'].querySelectorAll('input').map(e=>e.name),['hours','area','specialty']);
service.value='airport';await service.fire('change');assert.equal(ids['service-fields'].querySelectorAll('input')[0].value,'仁川');
await form.fire('submit');const mail=new URL(context.window.location.href);assert.equal(mail.protocol,'mailto:');assert.equal(mail.searchParams.get('body').includes('A & B? <hello>'),true);assert.equal(mail.searchParams.get('body').includes('仁川'),true);assert.match(ids['form-status'].textContent,/아직 전송되지/);assert.equal(form.elements.name.value,'山田 & Kim');
await ids['copy-quote'].fire('click');assert.match(copied,/山田 & Kim/);
context.navigator.clipboard.writeText=async()=>{throw new Error('denied');};await ids['copy-quote'].fire('click');assert.equal(ids['quote-output'].hidden,false);assert.match(ids['form-status'].textContent,/아래 내용/);
valid=false;context.window.location.href='';await form.fire('submit');assert.equal(context.window.location.href,'');
await ids['menu-toggle'].fire('click');assert.equal(ids['menu-toggle'].attrs['aria-expanded'],'true');await ids['menu-toggle'].fire('click');assert.equal(ids['menu-toggle'].attrs['aria-expanded'],'false');
console.log('PASS: bilingual switching, per-product fields and draft preservation, encoded email, copy fallback, validation, menu');
