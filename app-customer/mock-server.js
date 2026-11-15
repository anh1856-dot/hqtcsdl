/* Nấm Smart – máy chủ giả, dùng chung nghiệp vụ với chế độ demo trình duyệt. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const MockApi = require('./js/mock-api');
const PORT = Number(process.env.PORT || 3001);
const ROOT = __dirname;
const TYPES = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const respond = (res,status,obj) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) {
    const chunks=[];let length=0;
    req.on('data',part=>{length+=part.length;if(length>1024*1024){respond(res,413,{error:{message:'Dữ liệu vượt giới hạn 1 MB.'}});req.destroy();}else chunks.push(part);});
    req.on('end',()=>{
      let body={};
      try {body=chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};}
      catch(e){return respond(res,400,{error:{message:'JSON không hợp lệ.'}});}
      const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
      let result;
      try {result=MockApi.route(req.method,url.pathname+url.search,body,token);}
      catch(e){console.error('API error',e);return respond(res,500,{error:{message:'Lỗi máy chủ giả.'}});}
      const [status,out]=result;
      return respond(res,status,typeof out==='string' ? {error:{code:'MOCK_'+status,message:out}} : out);
    });
    return;
  }
  let rel;
  try {rel=decodeURIComponent(url.pathname);}catch(e){res.writeHead(400);return res.end('Bad path');}
  if(rel==='/')rel='/index.html';
  if(!/^\/(index\.html|css\/[^/]+\.css|js\/[^/]+\.js)$/.test(rel)) {res.writeHead(404);return res.end('Not found');}
  const file=path.resolve(ROOT,'.'+rel);
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream'});res.end(buf);});
}).listen(PORT,()=>console.log('Nấm Smart DEMO chạy tại http://localhost:'+PORT+' | Tài khoản mẫu: an.le@example.test / 123456'));
