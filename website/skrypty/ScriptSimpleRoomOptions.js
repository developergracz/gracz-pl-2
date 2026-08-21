jQuery(document).ready(function (){


  linkUIControls();

});

function linkUIControls()
{
  jQuery("#noRank").click(function (){
    //alert("No ranking");
  });

  jQuery("#noUndo").click(function (){
    //alert("No undo in game");
  });

  jQuery("#roomVisibility").change(function (){
    //alert("Room visibility");
  });

  jQuery("#gameDuration").change(function (){
    //alert("Duration of the game.");
  });

}