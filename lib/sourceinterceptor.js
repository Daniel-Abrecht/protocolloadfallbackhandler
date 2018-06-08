new (class SourceIntercepter {
  constructor(){
    var that = this;
    if(!self.nodeTypes){
      self.nodeTypes = new Map();
      for( let desc of Object.values(Object.getOwnPropertyDescriptors(window)) )
        try {
          if(desc.value.prototype instanceof Node)
            nodeTypes.set(desc.value.name, desc.value);
        } catch(e) {}
    }
    var excludeList = [
      HTMLAnchorElement,
      HTMLAreaElement
    ];
    for(let [name,type] of nodeTypes){
      let hasLoadableKeys = [];
      for(let key of ['src','href','srcset'])
        if(key in type.prototype)
          hasLoadableKeys.push(key);
      if(!hasLoadableKeys.length)
        continue;
      if(excludeList.indexOf(type) != -1)
        continue;
      this.control(type);
    }
    this.$onload = function(event){return sourceIntercepter.onload(this,event);};
    this.$onready = function(event){return sourceIntercepter.onready(this,event);};
    this.$onerror = function(event){return sourceIntercepter.onerror(this,event);};
    delete HTMLElement.prototype.loadState;
    Object.defineProperty(HTMLElement.prototype, 'loadState' ,{
      enumerable: false,
      configurable: true,
      get(){
        that.check(this);
        return this.$loadState;
      },
      set(state){
        if(state && ["loaderror","loading","ready","loaded"].indexOf(state) == -1)
          throw Error("invalid state");
        this.classList.remove("loaded");
        this.classList.remove("ready");
        this.classList.remove("loaderror");
        this.classList.remove("loading");
        if(state)
          this.classList.add(state);
        this.$loadState = state || null;
      }
    });
    this.checkDocument(document);
    self.sourceIntercepter = this;
  }
  control(type){
    var that = this;
    for(let key of ['src','href'])
      if(key in type.prototype)
        this.intercept(
          type.prototype, key,
          function(...x){ return that.getSource(this,key,...x); },
          function(...x){ return that.setSource(this,key,...x); }
        );
    if("poster" in type.prototype)
      this.intercept(
        type.prototype, "poster",
        function(){
          return protocolLoadFallbackHandler.getURIfromURL(this.nativePoster);
        },
        function(value){
          this.nativePoster = value;
          Promise.resolve(
            protocolLoadFallbackHandler.getCheckVirtualImageURL(this.nativePoster)
          ).then(url=>{
            if(this.nativePoster == value)
              this.nativePoster = url;
          });
        }
      );
  }
  intercept(obj,key,getter,setter){
    var desc = Object.getOwnPropertyDescriptor(obj, 'native'+ucfirst(key))
            || Object.getOwnPropertyDescriptor(obj, key);
    if(!desc)
      return false;
    var tmp = Object.create(desc);
    tmp.enumerable = false;
    tmp.configurable = true;
    Object.defineProperty(obj,'native'+ucfirst(key),desc);
    delete obj[key];
    Object.defineProperty(obj,key,{
      enumerable: desc.enumerable,
      configurable: true,
      get: getter,
      set: setter
    });
  }
  checkDocument(doc){
    if(!(doc instanceof Document))
      return;
    this.checkAll(doc);
    var observer = new MutationObserver(mutationsList=>{
      for(var mutation of mutationsList){
        if(mutation.type != 'childList')
          continue;
        for(let node of mutation.addedNodes)
          if(node instanceof HTMLElement)
            this.check(node);
      }
    });
    let onload = ()=>{
      if(["interactive","complete"].indexOf(doc.readyState) == -1)
        return;
      observer.disconnect();
      doc.removeEventListener("load",onload);
      this.checkAll(doc);
    };
    if(["interactive","complete"].indexOf(doc.readyState) == -1){
      observer.observe(doc, {childList: true, subtree: true});
      doc.addEventListener("readystatechange",onload,true);
    }
  }
  checkAll(base){
    if(!base || !(base instanceof Node))
      return;
    this.check(base);
    let n = base.children.length;
    for(let i=0; i<n; i++)
      this.checkAll(base.children[i]);
  }
  check(element){
    if(!(element instanceof HTMLElement))
      return;
    if('realSource' in element)
      return;
    CSSSourceIntercepter.processStyle(element.style);
    if(!["src","href"].some(a=>a in element))
      return;
    element.addEventListener("load",this.$onload,true);
    element.addEventListener("canplaythrough",this.$onload,true);
    element.addEventListener("loadeddata",this.$ready,true);
    element.realSource = element.nativeSrc || element.nativeHref;
    var state = null;
    if('complete' in element && 'naturalWidth' in element){ // img specific checks
      if(!element.complete){
        state = "loaderror";
      }else if(element.naturalWidth){
        state = "loaded";
      }else{
        state = "loading";
      }
    }
    if(element instanceof HTMLMediaElement){
      if(element.poster)
        element.poster = element.poster;
      if(element.error){
        state = "loaderror";
      }else if(element.readyState == HTMLMediaElement.HAVE_NOTHING){
        state = "loading";
      }else{
        if(element.readyState == HTMLMediaElement.HAVE_ENOUGH_DATA){
          state = "loaded"; // Not quiet, but close enough
        }else if(element.readyState){
          state = "ready";
        }else{
          state = "loading";
        }
      }
    }
    if(element instanceof HTMLTrackElement){
      switch(element.readyState){
        case HTMLTrackElement.LOADED : state = "loaded"; break;
        case HTMLTrackElement.LOADING: state = "loading"; break;
        case HTMLTrackElement.ERROR  : state = "loaderror"; break;
        case HTMLTrackElement.NONE   : state = null; break;
        default: state = null; break;
      }
    }
    this.loadState = state;
  }
  onload(element,event){
    element.loadState = "loaded";
  }
  onready(element,event){
    element.loadState = "ready";
  }
  onerror(event){
    protocolLoadFallbackHandler.onerror(event);
  }
  getSource(target,key){
    if(key){
      return target.realSource || target['native'+ucfirst(key)];
    }else{
      return target.realSource || target.nativeSrc || target.nativeHref;
    }
  }
  setNativeURI(element,nuri){
    if(element.nativeSrc){
      element.nativeSrc = nuri;
    }else if(element.nativeHref){
      element.nativeHref = nuri;
    }
  }
  getNativeURI(element){
    return element.nativeSrc
        || element.nativeHref;
  }
  setSource(target,key,uri){
    if(uri == target.realSource)
      return;
    if(target.classList){
      this.loadState = "loading";
    }
    if(!target.$sourcelock)
      target.realSource = uri;
    target.addEventListener("error",this.$onerror);
    target.addEventListener("load",this.$onload,true);
    target.addEventListener("canplaythrough",this.$onload,true);
    target.addEventListener("loadeddata",this.$onready,true);
    target['native'+ucfirst(key)] = uri;
  }
})();

