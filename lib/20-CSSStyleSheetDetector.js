(function(){
  if(!self.$pfh_lastCheckStyleSheets)
    self.$pfh_lastCheckStyleSheets = [];
  if(self.$pfh_interval)
    clearInterval(self.$pfh_interval);
  self.$pfh_interval = setInterval(function(){
    var checked = Symbol('checked');
    for( stylesheet of Array.from(document.styleSheets) ){
      var i = $pfh_lastCheckStyleSheets.indexOf(stylesheet);
      if(i == -1){
        $pfh_lastCheckStyleSheets.push(stylesheet);
        dispatchEvent(new CustomEvent("stylesheetadded",{detail:stylesheet}));
      }
      stylesheet[checked] = true;
    }
    for( var i=0; i<$pfh_lastCheckStyleSheets.length; i++ ){
      if($pfh_lastCheckStyleSheets[i][checked]){
        delete $pfh_lastCheckStyleSheets[i][checked];
      }else{
        var stylesheet = $pfh_lastCheckStyleSheets.splice(i--,1)[0];
        dispatchEvent(new CustomEvent("stylesheetremoved",{detail:stylesheet}));
      }
    }
  }, 333);
})();
