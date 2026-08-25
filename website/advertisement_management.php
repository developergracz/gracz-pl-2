<?php include("variables_local.php"); include_once($header); ?>

<div class="box light">
  <div class="corner top left"></div>
  <div class="corner bottom left"></div>
  <div class="corner top right"></div>
  <div class="corner bottom right"></div>
  <div class="border top"></div>
  <div class="border bottom"></div>
  <div class="border left"></div>
  <div class="border right"></div>
  <div class="content">
    <h1>Zarządzanie jednostkami reklamowymi</h1>
<?php

if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < ADMINISTRATOR) {
  http_response_code(403);
  echo('<div class="warning">Brak uprawnień administratora.</div>');
} else {
  $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';

  if ($method === 'POST' && isset($_POST['delete_id_advertisement'])) {
    try {
      AdvertisementsDelete(isset($_POST['token']) ? $_POST['token'] : '', intval($_POST['delete_id_advertisement']));
    } catch(Exception $e) {
      echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
    }
  }

  try {
    if ($method === 'POST' && isset($_POST['AddAdvertisementOK'])) {
      if (!isset($_POST['token']) || !IsTokenValid($_POST['token'])) {
        throw new ExceptionAccessDenied('Nieprawidłowy token bezpieczeństwa.');
      }

      // Ze względów bezpieczeństwa nie zezwalamy na SWF/Flash ani SVG.
      ReceiveAndSaveFile('filename', 1024*256, array('jpg','jpeg','png'), $directory['advertisements'], $filename);

      AdvertisementsAddNew(
        $_POST['token'],
        isset($_POST['id_advertisement_group']) ? intval($_POST['id_advertisement_group']) : 0,
        isset($_POST['description']) ? $_POST['description'] : '',
        $filename,
        isset($_POST['destination_address']) ? $_POST['destination_address'] : '',
        isset($_POST['purchased_views']) ? intval($_POST['purchased_views']) : 0
      );
      echo('<div class="positive">Operacja dodania nowej jednostki reklamowej zakończona pomyślnie.</div>');
    }
  } catch(Exception $e) {
    echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
  }

  try {
    AdvertisementsDisplayList();
  } catch(Exception $e) {
    echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
  }

  echo('<br /><br />
  <button type="button" onclick="jQuery(\'#add_advertisement_container\').show(); jQuery(this).hide();">Dodaj reklamę</button>
  <div id="add_advertisement_container" style="display:none;">
    <h3>Dodawanie jednostki reklamowej</h3>
    <form action="" method="post" enctype="multipart/form-data">
      <div>
        <input type="hidden" name="token" value="'.htmlspecialchars($_SESSION['token'], ENT_QUOTES, 'UTF-8').'" />
        <table>
          <caption>Formularz dodawania nowej jednostki reklamowej</caption>
          <tr><td><label for="id_advertisement_group">Grupa bannerów: </label></td>
          <td><select name="id_advertisement_group" id="id_advertisement_group">
            <option value="'.ADVERTISEMENT_MAIN.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_MAIN).'</option>
            <option value="'.ADVERTISEMENT_RIGHT_SIDE.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_RIGHT_SIDE).'</option>
            <option value="'.ADVERTISEMENT_LEFT_SIDE.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_LEFT_SIDE).'</option>
            <option value="'.ADVERTISEMENT_BOTTOM.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_BOTTOM).'</option>
          </select><span class="wymagane">*</span></td></tr>
          <tr><td>Nazwa pliku:</td><td><input type="file" size="22" name="filename" id="filename" accept="image/png,image/jpeg" required /><span class="wymagane">*</span><br /><span style="font-size:7pt">Dopuszczalne formaty: JPG, JPEG, PNG. Maks. 256 KB.</span></td></tr>
          <tr><td><label for="destination_address">Adres docelowy: </label></td><td><input type="url" name="destination_address" id="destination_address" /></td></tr>
          <tr><td><label for="purchased_views">Wykupionych wyświetleń: </label></td><td><input type="number" min="0" max="1000000000" name="purchased_views" id="purchased_views" value="10000" /><span class="wymagane">*</span></td></tr>
          <tr><td><label for="description">Opis jednostki: </label></td><td><textarea name="description" id="description" cols="30" rows="7" maxlength="2000"></textarea></td></tr>
          <tr><td></td><td><button type="submit" style="vertical-align:middle;" name="AddAdvertisementOK">Dodaj reklamę</button></td></tr>
        </table>
      </div>
    </form>
  </div>');

  echo('<br /><br /><br /><a href="'.$path['admin_panel'].'" class="button_normal">Powrót do panelu administracyjnego</a>');
}
?>
    <br style="clear:both;" />
  </div>
</div>

<?php include_once($footer); ?>