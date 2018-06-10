"use strict";

(function(){
if(typeof module != "undefined"){
  module.exports = (...x)=>module.exports.init(...x)
  module.exports.init = init;
}else{
  init();
}
function init(options){

options = options || {};

var pfh;

if(typeof module != "undefined"){
  pfh = module.exports;
  pfh.options = {};
}else{
  pfh = self;
}

for(let [name,val] of [
  ['replaceFetch', true],
  ['replaceXMLHttpRequest', true],
  ['serviceWorkerDoesHandleLoadFallbackHandlers', false],
  ['serviceWorkerPrefix', location.origin + "/proxy/"],
  ['fallbackProxyAvailable', false],
  ['proxybase', location.origin + "/proxy/"]
]){
  if(typeof self[name] == 'undefined'){
    if(name in options){
      self[name] = options[name];
    }else{
      self[name] = val;
    }
  }
  if(pfh != self && typeof pfh.options[name] == 'undefined')
    Object.defineProperty(pfh.options,name,{
      enumerable: true,
      configurable: true,
      get: ()=>self[name],
      set(val){self[name]=val;}
    });
}

function exportGlobal(name,value,keep){
  if(name in self && keep)
    return;
  self[name] = value;
  if(pfh != self){
    Object.defineProperty(pfh,name,{
      enumerable: true,
      configurable: true,
      get: ()=>self[name],
      set(val){self[name]=val;}
    });
  }
}

// See ~~-end.js for the end of the function that wraps everything
