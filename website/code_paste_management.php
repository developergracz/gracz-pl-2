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
    <h1>Zarządzanie kodami śledzenia i kodami reklamowymi</h1>
<?php

if (!isset($_SESSION['account_type']) || $_SESSION['account_type'] < ADMINISTRATOR) {
  http_response_code(403);
  echo('<div class="warning">Brak uprawnień administratora.</div>');
} else {
  $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';

  if ($method === 'POST' && isset($_POST['delete_id_codepaste'])) {
    try {
      if (!isset($_POST['token']) || !IsTokenValid($_POST['token'])) {
        throw new ExceptionAccessDenied('Nieprawidłowy token bezpieczeństwa.');
      }
      CodePasteDelete($_POST['token'], intval($_POST['delete_id_codepaste']));
    } catch(Exception $e) {
      echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
    }
  }

  try {
    if ($method === 'POST' && isset($_POST['AddCodepasteOK'])) {
      if (!isset($_POST['token']) || !IsTokenValid($_POST['token'])) {
        throw new ExceptionAccessDenied('Nieprawidłowy token bezpieczeństwa.');
      }
      CodePasteAddNew(
        $_POST['token'],
        isset($_POST['id_code_paste_group']) ? intval($_POST['id_code_paste_group']) : 0,
        isset($_POST['description']) ? (string)$_POST['description'] : '',
        isset($_POST['code_to_paste']) ? (string)$_POST['code_to_paste'] : ''
      );
      echo('<div class="positive">Operacja dodania nowego kodu śledzenia/reklamowego zakończona pomyślnie.</div>');
    }
  } catch(Exception $e) {
    echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
  }

  try {
    CodePasteDisplayList();
  } catch(Exception $e) {
    echo('<div class="negative">'.htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8').'</div>');
  }

  echo('
  <br />
  <button type="button" onclick="jQuery(\'#add_code_paste_container\').show(); jQuery(this).hide();">Dodaj kod śledzenia/reklamowy</button>
  <div id="add_code_paste_container" style="display:none;">
    <h3>Dodawanie kodu śledzenia lub kodu reklamowego</h3>
    <form action="" method="post">
      <div>
        <input type="hidden" name="token" value="'.htmlspecialchars($_SESSION['token'], ENT_QUOTES, 'UTF-8').'" />
        <table>
          <caption>Formularz dodawania kodu śledzenia lub reklamowego</caption>
          <tr><td><label for="id_code_paste_group">Miejsce wstawienia kodu: </label></td>
          <td><select name="id_code_paste_group" id="id_code_paste_group">
            <option value="'.CODE_PASTE_HEAD.'">'.CodePasteTransalateGroup(CODE_PASTE_HEAD).'</option>
            <option value="'.CODE_PASTE_BODY.'">'.CodePasteTransalateGroup(CODE_PASTE_BODY).'</option>
          </select></td></tr>
          <tr><td><label for="description">Opis jednostki: </label></td><td><textarea name="description" id="description" cols="110" rows="7" maxlength="2000"></textarea></td></tr>
          <tr><td><label for="code_to_paste">Kod do wstawienia: </label></td><td><textarea id="code_to_paste" name="code_to_paste" cols="96" rows="20" class="programCode" maxlength="50000"></textarea></td></tr>
          <tr><td></td><td><button type="submit" style="vertical-align:middle;" name="AddCodepasteOK">Dodaj kod</button></td></tr>
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