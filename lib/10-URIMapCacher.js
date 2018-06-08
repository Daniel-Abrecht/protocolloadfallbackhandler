new (class URIMapCacher extends EventTarget {
  constructor(){
    super();
    this.list = [];
    if(self.URIMapCacher){
      this.list = self.URIMapCacher.list;
    }
    self.URIMapCacher = this;
  }
  getURL(uri){
    for(let entry of this.list){
      if(entry.uri != uri)
        continue;
      entry.refcount++;
      if(entry.url)
        return entry.url;
      if(entry.promise)
        return entry.promise.then(()=>entry.url,()=>null);
      entry.refcount--;
      return null;
    }
    return null;
  }
  getURI(url){
    for(let entry of this.list){
      if(entry.url != url)
        continue;
      return entry.uri;
    }
    return null;
  }
  set(uri, url){
    if(url instanceof Promise){
      let e = null;
      for(let entry of this.list){
        if(entry.uri != uri)
          continue;
        e = entry;
        break;
      }
      if(e){
        e.refcount++;
      }else{
        this.list.push(e={
          uri,
          refcount: 1
        });
      }
      if(!e.promise){
        e.promise = new Promise((resolve,reject)=>{
          e.resolve = resolve;
          e.reject = reject;
        });
      }
      e.lastprom = url;
      return url.then(res=>{
        if(url != e.lastprom && !e.aborted)
          return false;
        delete e.lastprom;
        delete e.aborted;
        if(e.url){
          this.dispatchEvent(
            new CustomEvent("urlchange",{
              detail: {
                oldurl: e.url,
                url: res,
                uri: e.uri
              }
            })
          );
        }else{
          this.dispatchEvent(
            new CustomEvent("newurl",{
              detail: {
                url: res,
                uri: e.uri
              }
            })
          );
        }
        e.url = res;
        e.resolve();
        delete e.promise;
        delete e.resolve;
        delete e.reject;
        return true;
      },err=>{
        if(url != e.lastprom)
          return;
        e.aborted = true;
        if(!e.url)
          this.remove(e,err);
        delete e.promise;
        delete e.resolve;
        delete e.reject;
        return false;
      });
    }
    if( uri == url )
      return false;
    for(let entry of this.list){
      if(entry.uri != uri)
        continue;
      entry.refcount++;
      if(entry.url != url){
        this.dispatchEvent(
          new CustomEvent("urlchange",{
            detail: {
              oldurl: entry.url,
              url: url,
              uri: entry.uri
            }
          })
        );
        entry.url = url;
      }
      return true;
    }
    this.list.push({
      url, uri,
      refcount: 1
    });
    this.dispatchEvent( new CustomEvent("newurl",{ detail: { url, uri } }) );
    return true;
  }
  remove(entry,err){
    var i = this.list.indexOf(entry);
    if(i == -1)
      return;
    if(entry.reject)
      entry.reject(err);
    entry.refcount = 0;
    this.dispatchEvent(
      new CustomEvent("removed",{
        detail: {
          url: entry.url,
          uri: entry.uri
        }
      })
    );
    this.list.splice(i,1);
  }
  release(url){
    for(let i=0,n=this.list.length; i<n; i++){
      let entry = this.list[i];
      if(entry.url == url){
        if(!--entry.refcount){
          this.remove(entry);
        }
        return true;
      }
    }
    return false;
  }
})();
