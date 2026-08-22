<?php

echo('
  <br style="clear:both" />
  </article>
 ');

AdvertisementsDisplay(ADVERTISEMENT_LEFT_SIDE);
AdvertisementsDisplay(ADVERTISEMENT_RIGHT_SIDE);
AdvertisementsDisplay(ADVERTISEMENT_BOTTOM);

echo('
  <div id="notifications_container"></div>
  <footer><div class="footer">
    <span class="copyright"><span onclick="javascript:location.href=\''.$path['admin_panel'].'\'">&copy;</span> Wszystkie prawa zastrzeżone '.ObetnijAdres($service_base_address,true,true,true).' 2014'.((date('Y')==2014)?'':'-'.date('Y')).'</span>
    <span class="links">
      <a href="'.$path['terms_of_service'].'">Regulamin</a><span class="vertical_spacer">|</span>
      <a href="'.$path['privacy_policy'].'">Polityka ciasteczek</a><span class="vertical_spacer">|</span>
      <a href="#" onclick="openAbuseReportWindow(); return false;">Zgłoś nadużycie</a><span class="vertical_spacer">|</span>
      <a href="#" onclick="openBugReportWindow(); return false;">Zgłoś błąd</a><span class="vertical_spacer">|</span>
      <a href="'.$path['contact'].'">Kontakt</a>
    </span>
    <span class="licznik_zapytan_SQL">Ilość zapytań do bazy: '.$query_counter.'</span>
  </div></footer></div>
');

InsertAbuseReportWindowSupport();
InsertBugReportWindowSupport();

// Override legacy GET-based reporting helpers with POST-only versions.
echo '<script type="text/javascript">
(function($){
  window.reportAbuse = function(replyId, description, address) {
    $.ajax({url: '.json_encode($path['ajaxAbuse']).', method: "POST", dataType: "json",
      data: {action:"report", description:description, address:address, token:'.json_encode((string)$_SESSION['token']).'}})
    .done(function(data){ $("#"+replyId).hide().text(data.message || "Zgłoszenie wysłane.").slideDown(); if(data.state==="reported") $("#report_abuse form").slideUp(); })
    .fail(function(){ $("#"+replyId).hide().text("Nie udało się wysłać zgłoszenia.").slideDown(); });
  };
  window.reportBug = function(replyId, requestData, description, address) {
    $.ajax({url: '.json_encode($path['ajaxBug']).', method: "POST", dataType: "json",
      data: {action:"report", request_data:requestData, description:description, address:address, browser:navigator.userAgent, token:'.json_encode((string)$_SESSION['token']).'}})
    .done(function(data){ $("#"+replyId).hide().text(data.message || "Zgłoszenie wysłane.").slideDown(); if(data.state==="reported") $("#report_bug form").slideUp(); })
    .fail(function(){ $("#"+replyId).hide().text("Nie udało się wysłać zgłoszenia.").slideDown(); });
  };
})(jQuery);
</script>';

CodePasteDisplay(CODE_PASTE_BODY);
echo('\n</body>\n</html>\n');
include($actual_path."wykonanie_procedur_koncowych.php");
?>
