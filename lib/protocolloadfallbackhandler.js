"use strict";

if(typeof replaceFetch == 'undefined')
  self.replaceFetch = true;
if(typeof serviceWorkerDoesHandleLoadFallbackHandlers == 'undefined')
  self.serviceWorkerDoesHandleLoadFallbackHandlers = false;
if(typeof serviceWorkerPrefix == 'undefined')
  self.serviceWorkerPrefix = location.origin + "/proxy/";
if(typeof fallbackProxyAvailable == 'undefined')
  self.fallbackProxyAvailable = false;
if(typeof proxybase == 'undefined')
  self.proxybase = location.origin + "/proxy/";


self.ProtocolLoadFallbackHandlerError = class ProtocolLoadFallbackHandlerError extends Error {
  constructor(messageOrError,soft){
    super(messageOrError);
    if(messageOrError instanceof Error)
      Object.setPrototypeOf(this,messageOrError);
    this.soft = soft || false;
  }
};

new (class ProtocolLoadFallbackHandler {
  constructor(){
    if(!self.nativeFetch)
      self.nativeFetch = fetch;
    if(replaceFetch)
      self.fetch = (...args)=>this.fetch(...args);
    this.handlers = new Map();
    if(self.protocolLoadFallbackHandler){
      this.handlers = protocolLoadFallbackHandler.handlers;
      removeEventListener("error",self.protocolLoadFallbackHandler.$onerror);
    }
    self.protocolLoadFallbackHandler = this;
    this.$onerror = (...args) => this.onerror(...args);
    addEventListener("error",this.$onerror,true);
  }
  makeVirtualURI(uri){
    if(typeof uri != "string")
      return Promise.reject(new ProtocolLoadFallbackHandlerError("uri must be a string"));
    if( uri.startsWith(location.protocol)
     || uri.startsWith(proxybase)
     || uri.startsWith(serviceWorkerPrefix)
     || uri.startsWith("http:")
     || uri.startsWith("https:")
    ) return Promise.resolve(uri);
    if( serviceWorkerDoesHandleLoadFallbackHandlers
     && navigator.serviceWorker && navigator.serviceWorker.controller
    ){
      return Promise.resolve(serviceWorkerPrefix + btoa(uri));
    }else{
      var scheme = uri.match(/^([^:]+):/);
      scheme = scheme && scheme[1] || null;
      if(!scheme)
        return Promise.resolve(uri);
      return this.getHandler(scheme).then(handler=>{
        if(handler.makeVirtualURI){
          return handler.makeVirtualURI(uri);
        }else{
          return handler.fetch(uri)
                  .then(reponse=>reponse.blob())
                  .then(blob=>URL.createObjectURL(blob));
        }
      }).catch(e=>{
        if(!(e instanceof ProtocolLoadFallbackHandlerError) || !e.soft || !fallbackProxyAvailable)
          throw e;
        return proxybase + btoa(uri);
      });
    }
  }
  fetch(...args){
    if(!args.length)
      return Promise.reject(new ProtocolLoadFallbackHandlerError("Too few arguments"));
    var uri = null;
    if(typeof args[0] == "string")
      uri = args[0];
    if(args[0] instanceof Request)
      uri = args[0].url;
    if(typeof uri != "string")
      return Promise.reject(new ProtocolLoadFallbackHandlerError("first argument must be a string or Request object"));
    return nativeFetch(...args).catch(e=>{
      if( uri.startsWith(location.protocol)
       || uri.startsWith(serviceWorkerPrefix)
       || uri.startsWith("http:")
       || uri.startsWith("https:")
      ) throw e;
      if( serviceWorkerDoesHandleLoadFallbackHandlers
       && navigator.serviceWorker && navigator.serviceWorker.controller
      ){
        return nativeFetch(serviceWorkerPrefix + btoa(uri),...(args.slice(1)));
      }else{
        var scheme = uri.match(/^([^:]+):/);
        scheme = scheme && scheme[1] || null;
        if(!scheme)
          throw e;
        return this.getHandler(scheme).then(
          handler => {
            if(handler.fetch){
              return handler.fetch(...args).catch(e=>{
                if(!(e instanceof ProtocolLoadFallbackHandlerError) || !e.soft || !fallbackProxyAvailable)
                  throw e;
                return nativeFetch(proxybase + btoa(uri),...(args.slice(1)));
              });
            }else{
              return handler.makeVirtualURI(uri).then(nuri=>nativeFetch(nuri,...(args.slice(1))));
            }
          },
          error => {
            throw e;
          }
        );
      }
    });
  }
  renderTo(element,uri){
    var scheme = uri.match(/^([^:]+):/);
    scheme = scheme && scheme[1] || null;
    return this.getHandler(scheme).then(handler=>{
      if(handler.renderTo){
        try {
          element.$sourcelock = true;
          return Promise.resolve(handler.renderTo(element,uri)).then(
            ()=>{element.$sourcelock=false;},
            e=>{element.$sourcelock=false; throw e;}
          );
        }catch(e){
          return Promise.reject(e);
        }
      }else{
        return Promise.reject();
      }
    }).catch(e=>{
      if(e && !e.soft) console.error(e);
      return this.makeVirtualURI(uri).then(nuri=>{
        if(nuri == uri)
          throw new ProtocolLoadFallbackHandlerError("Failed to obtain a supportet URI");
        var curi = sourceIntercepter.getSource(element);
        if(uri != curi)
          return;
        sourceIntercepter.setNativeURI(element,nuri);
      });
    });
  }
  getHandler(scheme){
    return new Promise((resolve,reject)=>{
      var handler = this.handlers.get(scheme);
      if(handler){
        resolve(handler)
        return;
      }
      reject(new ProtocolLoadFallbackHandlerError("No such protocol handler available"));
    });
  }
  setHandler(name, handler){
    if(!handler.makeVirtualURI && !handler.fetch)
      throw new Error("A fallback protocol handler must have at least a fetch or a makeVirtualURI function");
    this.handlers.set(name, handler);
  }
  removeHandler(name){
    this.handlers.delete(name);
  }
  onerror(event){
    if(event.trueError)
      return;
    function trueLoadError(e){
      var message;
      if(!e){
        e = new Error("Failed to load resource "+sourceIntercepter.getSource(event.target));
      }else{
        message = "Failed to load resource "+sourceIntercepter.getSource(event.target);
        if(!!e.message)
          message = message + ': ' +e.message;
      }
      if(e instanceof Error){
        e = new ErrorEvent('error',{
          message: message,
          filename: e.fileName,
          lineno: e.lineNumber,
          colno: e.columnNumber,
          error: e,
          bubbles: false,
          cancelable: true,
          composed: true
        });
      }else if(e instanceof Event){
        if(!(e instanceof ErrorEvent)){
          let e2 = new ErrorEvent('error',{
            message: message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            error: e,
            bubbles: false,
            cancelable: true,
            composed: true
          });
          e = e2;
        }
      }
      e.trueError = true;
      var le = new ErrorEvent("loaderror",{
        message: message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e,
        bubbles: false,
        cancelable: true,
        composed: true
      });
      let cancelled = false;
      cancelled = cancelled || !event.target.dispatchEvent(le);
      cancelled = cancelled || !event.target.dispatchEvent(e);
      if(!cancelled){
        event.target.loadState = "loaderror";
        console.error(message);
      }
    }
    if(!(event.target instanceof HTMLElement))
      return true;
    sourceIntercepter.check(event.target);
    var uri = sourceIntercepter.getSource(event.target);
    var lasterror = event.target.lasterror;
    event.target.lasterror = {
      event: event,
      source: uri
    };
    if(!uri || uri.startsWith(location.protocol)
     || uri.startsWith("http:") || uri.startsWith("https:")
     || (lasterror && lasterror.source == uri)
    ){
      trueLoadError(event);
      return true;
    }
    event.target.loadState = "loading";
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if( serviceWorkerDoesHandleLoadFallbackHandlers
     && navigator.serviceWorker && navigator.serviceWorker.controller
    ){
      sourceIntercepter.setNativeURI(event.target,serviceWorkerPrefix + btoa(uri));
    }else{
      this.renderTo(event.target,uri).catch(e=>{
        if(e) console.error(e);
        trueLoadError(e);
      });
    }
    return false;
  }
})();
