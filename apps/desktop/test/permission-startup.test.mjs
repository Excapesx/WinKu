import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DesktopHost} from '../engine/host.mjs';

test('real dsh starts and answers in every desktop permission mode',{timeout:90000},async()=>{
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify({choices:[{index:0,delta:{content:'Permission startup OK'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const access of ['full','read-only','ask']){
  const home=mkdtempSync(join(tmpdir(),'winku-permission-')),host=new DesktopHost(home);
  try{
   await host.handle('provider.save',{id:'fixture',name:'Fixture',model:'fixture',protocol:'openai-chat-completions',baseURL:`http://127.0.0.1:${server.address().port}/v1`});
   await host.handle('preferences.save',{access,confirmFull:true,notifications:false});
   await host.handle('send',{text:'Verify permission startup',_key:'LOCAL_FAKE_KEY'});
   const deadline=Date.now()+25000;while(host.busy&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,30));
   const answer=host.state.sessions[0]?.messages.at(-1);assert.equal(host.busy,false,access);assert.ok(!answer?.error,`${access}: ${answer?.error}`);assert.equal(answer?.text,'Permission startup OK',access);
  }finally{await host.handle('shutdown');rmSync(home,{recursive:true,force:true});}
 }}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
