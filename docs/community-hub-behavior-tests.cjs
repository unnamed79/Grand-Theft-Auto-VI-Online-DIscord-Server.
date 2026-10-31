const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Node{constructor(tag,text='',cls=''){this.tag=tag;this.textContent=text;this.children=[];this.attrs={};this.className=cls;this.isConnected=true;this.hidden=false;this.classList={add:()=>{},remove:()=>{}};}append(...n){this.children.push(...n);}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}remove(){this.removed=true;}}
const source=fs.readFileSync('assets/hub.js','utf8');
const helpers=source.slice(source.indexOf('function authorLine'),source.indexOf('async function loadFeed'));
const calls=[],signed=[],queue=[];
const context={URL,Number,String,document:{createTextNode:t=>t},el:(...a)=>new Node(...a),button:(label,fn,cls)=>{const n=new Node('button',label,cls);n.onclick=fn;return n;},client:{storage:{from:()=>({createSignedUrl:async path=>{signed.push(path);return{data:{signedUrl:'https://example.invalid/'+path}};}})}},queueMicrotask:f=>queue.push(f),meta:row=>row.display_name,user:{id:'test'},busy:false,eligible:async()=>true,say:()=>{},api:async(action,p)=>{calls.push(p.value);return{score:p.value,my_vote:p.value}}};
vm.createContext(context);vm.runInContext(helpers,context);
(async()=>{
 const row={id:'p',title:'Post',score:0,my_vote:0};const vote=context.votes(row);await vote.children[0].onclick();await vote.children[0].onclick();await vote.children[2].onclick();await vote.children[3].onclick();assert.deepEqual(calls,[1,0,-1,0]);assert.equal(row.my_vote,0);assert.equal(vote.children[3].hidden,true);
 const image=context.attachmentMedia([{path:'image',mime:'image/png',description:'A hidden scene',filename:'image.png',bytes:100,spoiler:true}],true);const frame=image.children[0],img=frame.children[0];assert.equal(img.attrs['aria-hidden'],'true');assert.equal(img.alt,'Spoiler image hidden');await frame.children[1].onclick();assert.equal(img.attrs['aria-hidden'],undefined);assert.equal(img.alt,'A hidden scene');
 const video=context.attachmentMedia([{path:'video',mime:'video/mp4',description:'Gameplay clip',filename:'clip.mp4',bytes:100,spoiler:true}],true);const vf=video.children[0],v=vf.children[0];assert.equal(v.controls,false);assert.equal(v.preload,'none');assert.equal(!!v.autoplay,false);assert.equal(signed.includes('video'),false);await vf.children[1].onclick();await Promise.resolve();assert.equal(v.controls,true);assert.equal(v.attrs['aria-hidden'],undefined);assert.equal(signed.includes('video'),true);
 console.log('PASS: immediate vote toggles and removal; image spoiler reveal; video privacy, reveal and no autoplay.');
})().catch(e=>{console.error(e);process.exitCode=1;});

