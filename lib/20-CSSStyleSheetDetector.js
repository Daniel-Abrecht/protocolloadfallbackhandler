(function(){
  if(!self.$lastCheckStyleSheets)
    self.$lastCheckStyleSheets = [];
  if(self.$interval)
    clearInterval(self.$interval);
  self.$interval = setInterval(function(){
    var checked = Symbol('checked');
    for( stylesheet of Array.from(document.styleSheets) ){
      var i = $lastCheckStyleSheets.indexOf(stylesheet);
      if(i == -1){
        $lastCheckStyleSheets.push(stylesheet);
        dispatchEvent(new CustomEvent("stylesheetadded",{detail:stylesheet}));
      }
      stylesheet[checked] = true;
    }
    for( var i=0; i<$lastCheckStyleSheets.length; i++ ){
      if($lastCheckStyleSheets[i][checked]){
        delete $lastCheckStyleSheets[i][checked];
      }else{
        var stylesheet = $lastCheckStyleSheets.splice(i--,1)[0];
        dispatchEvent(new CustomEvent("stylesheetremoved",{detail:stylesheet}));
      }
    }
  }, 333);
})();
