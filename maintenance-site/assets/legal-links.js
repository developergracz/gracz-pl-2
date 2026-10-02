(function(){
  'use strict';

  document.addEventListener('click',function(event){
    var trigger=event.target.closest('[data-modal="terms"]');
    if(!trigger)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign('/regulamin/');
  },true);
})();