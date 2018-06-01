"use strict";

if(typeof replaceFetch == 'undefined')
  self.replaceFetch = true;
if(typeof replaceXMLHttpRequest == 'undefined')
  self.replaceXMLHttpRequest = true;
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
    if(!self.nativeXMLHttpRequest)
      self.nativeXMLHttpRequest = XMLHttpRequest;
    if(replaceXMLHttpRequest)
      self.XMLHttpRequest = this.XMLHttpRequest;
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
  isURIexempt(uri){
    if(!/^[a-zA-Z0-9+-.]*:/.test(uri))
      return true;
    if( uri.startsWith(location.protocol)
     || uri.startsWith("http:")
     || uri.startsWith("https:")
     || uri.startsWith("file:")
    ) return true;
    if(fallbackProxyAvailable && uri.startsWith(proxybase))
      return true;
    if( serviceWorkerDoesHandleLoadFallbackHandlers
     && navigator.serviceWorker
     && navigator.serviceWorker.controller
     && uri.startsWith(serviceWorkerPrefix)
    ) return true;
    return false;
  }
  makeVirtualURI(uri){
    if(typeof uri != "string")
      return Promise.reject(new ProtocolLoadFallbackHandlerError("uri must be a string"));
    if( this.isURIexempt(uri) )
      return Promise.resolve(uri);
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
  get XMLHttpRequest(){
    var events = [
      "abort", "error", "load",
      "loadstart", "progress",
      "timeout", "loadend",
      "readystatechange"
    ];
    var esym = {};
    var priv = Symbol("priv");
    var onerror = Symbol("onerror");
    var onabort = Symbol("onabort");
    var onload = Symbol("onload");
    var onloadstart = Symbol("onloadstart");
    var onloadend = Symbol("onloadend");
    var onprogress = Symbol("onprogress");
    var onreadystatechange = Symbol("onreadystatechange");
    var ontimeout = Symbol("ontimeout");
    var fetchresolve = Symbol("fetchresolve");
    var fetchfailure = Symbol("fetchfailure");
    var setreadystate = Symbol("setreadystate");
    var XMLHttpRequest = class XMLHttpRequest extends EventTarget {
      constructor(){
        super();
        var p = this[priv] = {
          headers: [],
          native: true,
          request: null,
          requestHeaders: null,
          responseHeaders: null,
          responseType: "",
          response: null,
          fetchPromise: null,
          fetchController: null,
          withCredentials: false,
          status: 0,
          statusText: "",
          forcedMime: null,
          readyState: XMLHttpRequest.UNSENT
        };
        p.xhr = new nativeXMLHttpRequest();
        p.xhr.onerror = (...a)=>this[onerror](...a);
        p.xhr.onabort = (...a)=>this[onabort](...a);
        p.xhr.onload = (...a)=>this[onload](...a);
        p.xhr.onloadstart = (...a)=>this[onloadstart](...a);
        p.xhr.onloadend = (...a)=>this[onloadend](...a);
        p.xhr.onprogress = (...a)=>this[onprogress](...a);
        p.xhr.onreadystatechange = (...a)=>this[onreadystatechange](...a);
        p.xhr.ontimeout = (...a)=>this[ontimeout](...a);
      }
      [onerror](e){
        var p = this[priv];
        var event = new e.constructor(e.type,e);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if(p.native){
          if( ('sending' in p) && p.readyState == XMLHttpRequest.OPENED
           && !protocolLoadFallbackHandler.isURIexempt(p.request.url)
          ){
            p.native = false;
            p.readyState = XMLHttpRequest.OPENED;
            this.send(...p.sending);
          }else{
            p.readyState = XMLHttpRequest.DONE;
            this.dispatchEvent(event);
          }
        }
        return false;
      }
      [onabort](event){
        event = new event.constructor(event.type,event);
        if(this[priv].native)
          this.dispatchEvent(event);
      }
      [onload](event){
        event = new event.constructor(event.type,event);
        if(this[priv].native)
          this.dispatchEvent(event);
      }
      [onloadstart](event){
        var p = this[priv];
        event = new event.constructor(event.type,event);
        if(this[priv].native){
          if( !protocolLoadFallbackHandler.isURIexempt(p.request.url)
           && p.xhr.readyState == XMLHttpRequest.DONE
           && p.xhr.status == 0
          ) return;
          this.dispatchEvent(event);
        }
      }
      [onloadend](event){
        var p = this[priv];
        event = new event.constructor(event.type,event);
        if(this[priv].native){
          if( !protocolLoadFallbackHandler.isURIexempt(p.request.url)
           && p.xhr.readyState == XMLHttpRequest.DONE
           && p.xhr.status == 0
          ) return;
          this.dispatchEvent(event);
        }
      }
      [onprogress](event){
        event = new event.constructor(event.type,event);
        if(this[priv].native)
          this.dispatchEvent(event);
      }
      [onreadystatechange](event){
        var p = this[priv];
        event = new event.constructor(event.type,event);
        if(p.native){
          if( !protocolLoadFallbackHandler.isURIexempt(p.request.url)
           && p.xhr.readyState == XMLHttpRequest.DONE
           && p.xhr.status == 0
          ) return; // Ready state set from 1 to 4, likely due to an error, ignore it.
          this.dispatchEvent(event);
          p.readyState = p.xhr.readyState;
        }
      }
      [ontimeout](event){
        event = new event.constructor(event.type,event);
        if(this[priv].native)
          this.dispatchEvent(event);
      }
      [setreadystate](state){
        var p = this[priv];
        if(p.native)
          return;
        if(p.readyState == state)
          return;
        p.readyState = state;
        this.dispatchEvent(new Event("readystatechange"));
      }
      [fetchresolve](response){
        var that = this;
        var p = this[priv];
        if(p.native)
          return;
        p.responseHeaders = response.headers;
        p.status = response.status;
        p.statusText = response.statusText;
        this[setreadystate](XMLHttpRequest.HEADERS_RECEIVED);
        this.dispatchEvent(new Event("loadstart"));
        function finish(response){
          var type = p.responseType || 'text';
          var res = Promise.resolve(null);
          switch(type){
            case "text": res = response.text(); break;
            case "blob": res = response.blob(); break;
            case "json": res = response.json(); break;
            case "arraybuffer": res = response.arrayBuffer(); break;
            case "document": {
              res = response.text().then(text=>{
                if(p.forcedMime)
                  return new DOMParser().parseFromString(text, p.forcedMime);
                try {
                  return new DOMParser().parseFromString(text, response.headers.get("Content-Type") || "text/html");
                } catch(e) {
                  return new DOMParser().parseFromString(text, "text/html");
                }
              });
            } break;
          }
          res.then(function(result){
            p.response = result;
            var progress = {
              loaded: result && result.length || 0,
              total: 0,
              lengthComputable: false
            };
            that[setreadystate](XMLHttpRequest.DONE);
            that.dispatchEvent(new ProgressEvent("loadend",progress));
            that.dispatchEvent(new ProgressEvent("load",progress));
          });
        }
        if(response.body){
          let length = p.responseHeaders.get("Content-Length");
          if(length === null){
            let range = p.responseHeaders.get("Content-Range");
            if(range){
              range = range.match(/bytes (\d+)-(\d+)/);
              if(range)
                length = range[2]-range[1];
            }
          }
          if(length === null){
            let range = p.requestHeaders.get("Range");
            if(range){
              range = range.match(/bytes=(\d+)-(\d+)/);
              if(range)
                length = range[2]-range[1];
            }
          }
          let readfail = function(error){
            if(!(error instanceof Error)){
              that.dispatchEvent(new ErrorEvent("error",{
                message: message,
                filename: e.fileName,
                lineno: e.lineNumber,
                colno: e.columnNumber,
                error: e,
                bubbles: false,
                cancelable: true,
                composed: true
              }));
            }
            that[setreadystate](XMLHttpRequest.DONE);
          };
          var that = this;
          let count = 0;
          let responseCopy = response.clone();
          let reader = response.body.getReader();
          reader.read().then(function process({done,value}){
            if( p.readyState != XMLHttpRequest.HEADERS_RECEIVED
             && p.readyState != XMLHttpRequest.LOADING
            ){
              reader.releaseLock();
              reader = null;
              p.fetchController = null;
              p.fetchPromise = null;
              return;
            }
            let offset = count;
            if(value)
              count += value.byteLength;
            var progress = {
              loaded: count,
              total: length,
              lengthComputable: length !== null
            };
            that.dispatchEvent(new ProgressEvent("progress",progress));
            if(done){
              finish(responseCopy);
              return;
            }
            that[setreadystate](XMLHttpRequest.LOADING);
            reader.read().then(process).catch(readfail);
          }).catch(readfail);
        }else{
          finish(response);
        }
      }
      [fetchfailure](error){
        var p = this[priv];
        if(p.native)
          return;
        var event = new ErrorEvent("error",{
          message: error.message,
          filename: error.fileName,
          lineno: error.lineNumber,
          colno: error.columnNumber,
          error: error,
          bubbles: false,
          cancelable: true,
          composed: true
        });
        this[setreadystate](XMLHttpRequest.DONE);
        this.dispatchEvent(event);
      }
      get readyState(){
        var p = this[priv];
        return p.native ? p.xhr.readyState : p.readyState;
      }
      get response(){
        var p = this[priv];
        if(p.native)
          return p.xhr.response;
        return p.response;
      }
      get responseText(){
        var p = this[priv];
        if(p.native)
          return p.xhr.responseText;
        if((p.responseType||'text') == 'text')
          return p.response;
        return null;
      }
      get responseURL(){
        var p = this[priv];
        if(p.native)
          return p.xhr.responseURL;
        return p.request && p.request.url || null;
      }
      get responseXML(){
        var p = this[priv];
        if(p.native)
          return p.xhr.responseXML;
        if(p.responseType == 'document')
          return p.response;
        return null;
      }
      get status(){
        var p = this[priv];
        if(p.native)
          return p.xhr.status;
        return p.status;
      }
      get statusText(){
        var p = this[priv];
        if(p.native)
          return p.xhr.statusText;
        return p.statusText;
      }
      get upload(){
        var p = this[priv];
        if(p.native)
          return p.xhr.upload;
        return null; // TODO
      }
      get responseType(){
        var p = this[priv];
        if(p.native)
          return p.xhr.responseType;
        return p.responseType || 'text';
      }
      set responseType(value){
        if([ "text", "arraybuffer", "blob", "json", "document" ].indexOf(value) == -1 )
          return;
        var p = this[priv];
        p.xhr.responseType = value;
        p.responseType = value;
      }
      get withCredentials(){
        var p = this[priv];
        if(p.native)
          return p.xhr.withCredentials;
        return p.withCredentials;
      }
      set withCredentials(value){
        var p = this[priv];
        p.xhr.withCredentials = value;
        p.withCredentials = value;
      }
      open(method, url, async, user, password){
        var p = this[priv];
        p.request = {
          method, url, async,
          user, password
        };
        p.xhr.open(method, url, async, user, password);
        p.status = 0;
        p.statusText = "";
        p.requestHeaders = new Headers();
        p.requestHeaders.delete('Authorization');
        if(user || password)
          p.requestHeaders.set('Authorization', 'Basic '+btoa(user+':'+password));
        p.responseHeaders = null;
        p.responseType = "";
        p.response = null,
        p.native = true;
        p.fetchPromise = null;
        p.fetchController = null;
        p.withCredentials = false;
        p.forcedMime = null;
        this[setreadystate](XMLHttpRequest.OPENED);
      }
      send(...args){
        var p = this[priv];
        if(p.readyState != XMLHttpRequest.OPENED)
          throw new DOMException("Failed to execute 'send' on 'XMLHttpRequest': The object's state must be OPENED");
        delete p.sending;
        if(p.native){
          p.sending = args;
          return p.xhr.send(...args);
        }else{
          let headers = null;
          var params = {};
          params.method = p.request.method;
          if(!p.requestHeaders.entries().next().done)
            params.headers = p.requestHeaders;
          if(args.length >= 1)
            params.body = args[0];
          if(typeof AbortController != 'undefined'){
            this.fetchController = new AbortController();
            params.signal = this.fetchController.signal;
          }
          p.fetchPromise = protocolLoadFallbackHandler.fetch(p.request.url,params);
          p.fetchPromise.then(
            response => this[fetchresolve](response),
            error => this[fetchfailure](error)
          );
        }
      }
      abort(){
        var p = this[priv];
        if(p.native){
          p.xhr.abort();
        }else{
          if(p.fetchController)
            p.fetchController.abort();
          if(p.fetchPromise)
            this.dispatchEvent(new Event("abort"));
          p.fetchController = null;
          p.fetchPromise = null;
        }
      }
      getAllResponseHeaders(){
        var p = this[priv];
        if(p.native){
          return p.xhr.getAllResponseHeaders();
        }else{
          let res = "";
          if(p.responseHeaders)
          for(let [key,value] of p.responseHeaders)
            res += key + ': ' + value + "\r\n";
          return res;
        }
      }
      setRequestHeader(header, value){
        var p = this[priv];
        if(this.readyState != XMLHttpRequest.OPENED)
          throw new DOMException("Failed to execute 'setRequestHeader' on 'XMLHttpRequest': The object's state must be OPENED");
        p.xhr.setRequestHeader(header, value);
        p.requestHeaders.append(header, value);
      }
      getResponseHeader(headerName){
        var p = this[priv];
        if(p.native){
          return p.xhr.getResponseHeader(headerName);
        }else{
          if(!p.responseHeaders)
            return null;
          return p.responseHeaders.get(headerName);
        }
      }
      overrideMimeType(mimeType){
        var p = this[priv];
        p.forcedMime = mimeType;
        if(p.native)
          return p.xhr.overrideMimeType(mimeType);
      }
    };
    for(let [name,value] of [
      ["UNSENT",0], ["OPENED",1],
      ["HEADERS_RECEIVED",2],
      ["LOADING",3], ["DONE",4]
    ]){
      XMLHttpRequest[name] = value;
      XMLHttpRequest.prototype[name] = value;
    }
    for(let event of events){
      esym[event] = Symbol(event);
      Object.defineProperty(XMLHttpRequest.prototype,"on"+event,{
        configurable: false,
        enumerable: true,
        get(){
          return XMLHttpRequest[esym[event]] || null;
        },
        set(value){
          if(XMLHttpRequest[esym[event]])
            this.removeEventListener(event,XMLHttpRequest[esym[event]]);
          XMLHttpRequest[esym[event]] = value;
          this.addEventListener(event,XMLHttpRequest[esym[event]]);
        }
      })
    }
    return XMLHttpRequest;
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
      if( this.isURIexempt(uri) )
        throw e;
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
      reject(new ProtocolLoadFallbackHandlerError("No protocol fallback handler for scheme "+scheme+" available"));
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
    if(!(event.target instanceof HTMLElement))
      return true;
    function trueLoadError(e){
      var message = "Failed to load <"+event.target.nodeName.toLowerCase()+"> from "+sourceIntercepter.getSource(event.target);
      if(!e){
        e = new Error(message);
      }else{
        if(!!e.message)
          message = message + ': ' +e.message;
      }
      if(!!event.message)
        message += '\nPrevious error from browser was: '+event.message;
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
    sourceIntercepter.check(event.target);
    var uri = sourceIntercepter.getSource(event.target);
    var lasterror = event.target.lasterror;
    event.target.lasterror = {
      event: event,
      source: uri
    };
    if( !uri || this.isURIexempt(uri)
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
        trueLoadError(e);
      });
    }
    return false;
  }
})();
