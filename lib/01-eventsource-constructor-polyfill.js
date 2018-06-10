try {
  new EventTarget();
} catch(e) {
  // If the EventTarget constructor isn't supported, replace it with a polyfill
  let listeners = Symbol("listeners");
  exportGlobal('nativeEventTarget',EventTarget,true);
  exportGlobal('EventTarget', function EventTarget(){
    if(!new.target)
      throw new TypeError("class constructors must be invoked with |new|");
    function EventTarget(){
      this[listeners] = {};
    }
    EventTarget.prototype = {
      addEventListener(type, callback){
        if(!this[listeners][type])
          this[listeners][type] = [];
        this[listeners][type].push(callback);
      },
      removeEventListener(type, callback){
        var list = this[listeners][type];
        if(!list) return;
        var i = this[listeners][type].indexOf(callback);
        if(i == -1) return;
        list.splice(i, 1);
      },
      dispatchEvent(event){
        var list = this[listeners][event.type];
        if(!list) return true;
        for( var i=0,n=list.length; i<n; i++)
          list[i].call(this, event);
        return !event.defaultPrevented;
      }
    };
    // fake the instanceof check for EventTarget instances with this function to return true
    Object.setPrototypeOf(EventTarget.prototype, nativeEventTarget.prototype); // 
    // Correct prototype from new
    Object.setPrototypeOf(Object.getPrototypeOf(this),EventTarget.prototype);
    EventTarget.apply(this);
  });
  // fake the instanceof check for nativeEventTarget instances with this function to return true
  EventTarget.prototype = nativeEventTarget.prototype;
}
