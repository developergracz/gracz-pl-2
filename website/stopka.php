<?php

echo('
  <br style="clear:both" />
  </article>  <!-- Od zawartości -->
 ');

  AdvertisementsDisplay(ADVERTISEMENT_LEFT_SIDE);
  AdvertisementsDisplay(ADVERTISEMENT_RIGHT_SIDE);
  AdvertisementsDisplay(ADVERTISEMENT_BOTTOM);

  echo('
  <div id="notifications_container"></div>

    <!-- Stopka -->
    <footer>
      <div class="footer">    <!-- IE8 Workaround -->
        <span class="copyright"><span onclick="javascript:location.href=\''.$path['admin_panel'].'\'">&copy;</span> Wszystkie prawa zastrzeżone '.ObetnijAdres($service_base_address,true,true,true).' 2014'.((date('Y')==2014)?'':'-'.date('Y')).'</span>

        <span class="links">
         <a href="'.$path['terms_of_service'].'">Regulamin</a>
         <span class="vertical_spacer">|</span>
         <a href="'.$path['privacy_policy'].'">Polityka ciasteczek</a>
         <span class="vertical_spacer">|</span>
         <a href="#" onclick="openAbuseReportWindow(); return false;">Zgłoś nadużycie</a>
         <span class="vertical_spacer">|</span>
         <a href="#" onclick="openBugReportWindow(); return false;">Zgłoś błąd</a>
         <span class="vertical_spacer">|</span>
         <a href="'.$path['contact'].'">Kontakt</a>
        </span>

        <span class="licznik_zapytan_SQL">Ilość zapytań do bazy: '.$query_counter.'</span>
      </div>
    </footer>
  </div>

');
  InsertAbuseReportWindowSupport();
  InsertBugReportWindowSupport();
  // Pasting tracking code or advertisement system code
  CodePasteDisplay(CODE_PASTE_BODY);


echo('
</body>
</html>
');

include($actual_path."wykonanie_procedur_koncowych.php");

?>