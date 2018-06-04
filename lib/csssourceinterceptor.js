if(!CSS.escape)
  CSS.escape = x=>JSON.stringify(x).substr(1,x.length);

new (class CSSSourceIntercepter {

  constructor(){

    if(!self.CSSSourceIntercepter){
      self.CSSSourceIntercepter = this;

      let subject = document.createElement("div");

      for( let method of Object.getOwnPropertyNames(new.target.prototype) ){
        if(method == 'constructor')
          continue;
        if(!(this[method] instanceof Function))
          continue;
        for( let styleinterface of [
          self.CSSStyleDeclaration,
          self.CSS2Properties,
          Object.getPrototypeOf(subject.style)
        ]){
          if(!styleinterface)
            continue;
          if(styleinterface.prototype)
            styleinterface = styleinterface.prototype;
          if(!styleinterface[method])
            continue;
          if(("native"+ucfirst(method)) in styleinterface)
            continue;
          Object.defineProperty(styleinterface,"native"+ucfirst(method),{
            enumerable: false,
            configurable: true,
            value: styleinterface[method]
          });
          delete styleinterface[method];
          Object.defineProperty(styleinterface,method,{
            enumerable: false,
            configurable: true,
            value(...args){
              return self.CSSSourceIntercepter[method](this,...args);
            }
          });
        }
      }

      for( let styleinterface of [
        self.CSSStyleDeclaration,
        self.CSS2Properties,
        self.CSSStyleRule,
        Object.getPrototypeOf(subject.style)
      ]){
        if(!styleinterface)
          continue;
        if(styleinterface.prototype)
          styleinterface = styleinterface.prototype;
        if(Object.getOwnPropertyDescriptor(styleinterface,"nativeCssText"))
          continue;
        let desc = Object.getOwnPropertyDescriptor(styleinterface,"cssText");
        if(!desc)
          continue;
        desc.enumerable = false;
        Object.defineProperty(styleinterface,"nativeCssText",desc);
        delete styleinterface["cssText"];
        Object.defineProperty(styleinterface,"cssText",{
          enumerable: true,
          configurable: true,
          get(){
            return self.CSSSourceIntercepter.CSSTransformURLs(this.nativeCssText);
          },
          set(value){
            if(this instanceof CSSStyleRule)
              return;
            this.nativeCssText = self.CSSSourceIntercepter.CSSTransformURIs(this,"cssText",value);
          }
        });
      }

      {
        let desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype,'style');
        desc.enumerable = false;
        Object.defineProperty(HTMLElement.prototype,"nativeStyle",desc);
        delete HTMLElement.prototype.style;
        Object.defineProperty(HTMLElement.prototype,"style",{
          enumerable: true,
          configurable: true,
          get(){
            return this.nativeStyle;
          },
          set(value){
            this.nativeStyle.cssText = value;
          }
        });
      }

      for(let attr in subject.style){
        if(attr in this)
          continue;
        if(typeof subject.style[attr] != "string")
          continue;
        let attr_dashes = attr.replace(/[A-Z]/g,x=>"-"+x.toLowerCase());
        if(!CSS.supports(attr_dashes,"url(.)"))
          continue;
        let desc = {
          enumerable: true,
          configurable: true,
          get(){
            return self.CSSSourceIntercepter.getPropertyValue(this,attr_dashes);
          },
          set(value){
            self.CSSSourceIntercepter.setProperty(this,attr_dashes,value);
          }
        };
        for( let styleinterface of [
          self.CSSStyleDeclaration,
          self.CSS2Properties,
          Object.getPrototypeOf(subject.style)
        ]){
          if(!styleinterface)
            continue;
          if(styleinterface.prototype)
            styleinterface = styleinterface.prototype;
          delete styleinterface[attr];
          Object.defineProperty(styleinterface,attr,desc);
          if(attr != attr_dashes){
            desc.enumerable = false;
            delete styleinterface[attr_dashes];
            Object.defineProperty(styleinterface,attr_dashes,desc);
          }
        }
      }

      addEventListener(
        "stylesheetadded",
        event => self.CSSSourceIntercepter.processStyleSheet(event.detail)
      );

    }

    for(let stylesheet of Array.from(document.styleSheets))
      this.processStyleSheet(stylesheet);

    self.CSSSourceIntercepter = this;
  }

  processStyle(style){
    for( let name of Array.from(style) ){
      if(!CSS.supports(name,"url(.)"))
        continue;
      style[name] = style[name];
    }
  }

  processStyleSheet(stylesheet){
    for( let rule of Array.from(stylesheet.cssRules) ){
      if(rule instanceof CSSGroupingRule){
        process(rule);
      }else if(rule instanceof CSSStyleRule){
        this.processStyle(rule.style);
      }
    }
  }

  CSSUnescape(value){
    value = value.replace(/\\[^bfnrtu\\]/g,x=>x.substr(1));
    value = JSON.parse('"'+value+'"');
    return decodeURI(value);
  }

  getCSSURIs(value){
    return ((""+value).match(/url\(\s*([^)]+|'[^']+'|"[^"]+")\s*\)/g)||[])
      .map(uri=>this.CSSUnescape(uri.match(/^url\(\s*(['"]?)(.*)\1\s*\)$/)[2].trim()))
      .filter(uri=>/^[a-z0-9+-.]+:/i.test(uri))
      .filter(uri=>!protocolLoadFallbackHandler.isURIexempt(uri));
  }

  CSSURIReplace(value,uri,url){
    return value.replace(/url\(\s*([^)]+|'[^']+'|"[^"]+")\s*\)/g,val=>{
      let tmp = val.match(/^url\(\s*(['"]?)(.*)\1\s*\)$/)[2].trim();
      tmp = this.CSSUnescape(tmp);
      if(tmp == decodeURI(uri))
        return 'url("'+CSS.escape(url)+'")';
      return val;
    });
  }

  CSSTransformURIs(style,name,value){
    var uris = this.getCSSURIs(value);
    for(let uri of uris){
      let decoded_uri = decodeURI(uri);
      let result = protocolLoadFallbackHandler.getCheckVirtualImageURL(decoded_uri);
      let loadable_uri = result instanceof Promise ? decoded_uri : result;
      if(result instanceof Promise)
        result.then(url=>this.applyLoadableURL(style,name,uri,url));
      value = this.CSSURIReplace(value,uri,loadable_uri);
    }
    return value;
  }

  CSSTransformURLs(value){
    var uris = this.getCSSURIs(value)
    for(let uri of uris){
      let decoded_uri = this.CSSUnescape(uri);
      let url = protocolLoadFallbackHandler.getURIfromURL(decoded_uri);
      value = this.CSSURIReplace(value, uri, url);
    }
    return value;
  }

  applyLoadableURL(style,name,uri,url){
    if(uri == url)
      return;
    var value = style.nativeGetPropertyValue(name);
    var newvalue = this.CSSURIReplace(value,uri,url);
    if(value == newvalue)
      return;
    style.nativeSetProperty(name,newvalue);
  }

  getPropertyValue(style,name){
    var value = style.nativeGetPropertyValue(name);
    return this.CSSTransformURLs(value);
  }

  setProperty(style,name,value){
    value = this.CSSTransformURIs(style,name,value);
    return style.nativeSetProperty(name,value);
  }

})();
