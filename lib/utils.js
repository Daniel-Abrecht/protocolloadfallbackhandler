"use strict";

function logStack(){
  console.log(new Error().stack);
}

function ucfirst(string){
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function parseRange(str){
  let ranges = str.split(/ *, */);
  var result = [];
  for(let range of ranges){
    var r=null, a=[];
    if(r=range.match(/^(\d)-(\d)$/)){
      a = Array.from(new Uint32Array(r[2]-r[1]+1)).map((x,i)=>(i+ +r[1]).toString());
    }else if(r=range.match(/^(\d)$/)){
      a = [r[1]];
    }
    result = result.concat(a);
  }
  return Array.from(new Set(result));
}

function readStreamToReadableStream(stream){
  if(!stream.readable)
    throw new Error("Stream isn't readable");
  return new ReadableStream({
    start(controller){
      stream.on("data",chunk=>{
        controller.enqueue(chunk);
      });
      stream.on("end",()=>{
        controller.close();
      });
    }
  });
}
