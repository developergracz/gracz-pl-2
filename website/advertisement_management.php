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

        if (isset($_REQUEST['delete_id_advertisement']))
        {
          try
          {
            AdvertisementsDelete($_REQUEST['token'], $_REQUEST['delete_id_advertisement']);
          }catch(Exception $e)
          {
            echo($e);
          }
        }

        // Jeśli formularz został przesłany
        try
        {
          if (isset($_POST['AddAdvertisementOK']))
          {
            ReceiveAndSaveFile('filename',1024*256,array('jpg','jpeg','png','gif','swf'),$directory['advertisements'],$filename);

            try
            {
              AdvertisementsAddNew($_POST['token'], $_POST['id_advertisement_group'],$_POST['description'],$filename,$_POST['destination_address'],$_POST['purchased_views']);
              echo('<div class="positive">Operacja dodania nowej jednostki reklamowej zakończona pomyślnie.</div>');
            }catch(Exception $e)
            {
              echo($e);
            }
          }
        }catch(Exception $e)
        {
          echo($e);
        }


        try {
          AdvertisementsDisplayList();
        }catch(Exception $e)
        {
          echo($e);
        }

  if ($_SESSION['account_type']>=ADMINISTRATOR)
  {
   echo('<br /><br />
   <button type="button" onclick="jQuery(\'#add_advertisement_container\').show(); jQuery(this).hide();">Dodaj reklamę</button>
   <div id="add_advertisement_container" style="display:none;">
     <h3>Dodawanie jednostki reklamowej</h3>
     <form action="" method="post" enctype="multipart/form-data" >
       <div>
        <input type="hidden" name="token" value="'.$_SESSION['token'].'" />
        <table>
        <caption>Formularz dodawania nowej jednostki reklamowej</caption>
          <tr><td><label for="id_advertisement_group">Grupa bannerów: </label></td>
             <td>
            <select name="id_advertisement_group" id="id_advertisement_group" >
            <option value="'.ADVERTISEMENT_MAIN.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_MAIN).'</option>
            <option value="'.ADVERTISEMENT_RIGHT_SIDE.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_RIGHT_SIDE).'</option>
            <option value="'.ADVERTISEMENT_LEFT_SIDE.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_LEFT_SIDE).'</option>
            <option value="'.ADVERTISEMENT_BOTTOM.'">'.AdvertisementsTransalateGroup(ADVERTISEMENT_BOTTOM).'</option>
            </select>
             <span class="wymagane">*</span>
            </td>
         </tr>
          <tr><td>Nazwa pliku:</td><td><input type="file" size="22" name="filename" id="filename" /><span class="wymagane">*</span><br /><span style="font-size:7pt">Dopuszczalne rozszerzenia: SWF, JPG, JPEG, PNG, GIF</span></td></tr>
          <tr><td><label for="destination_address">Adres docelowy: </label></td><td><input type="text" name="destination_address" id="destination_address" /> <span style="font-size:7pt">(Nie dotyczy plików SWF)</span></td></tr>
          <tr><td><label for="purchased_views">Wykupionych wyświetleń: </label></td><td><input type="text" name="purchased_views" id="purchased_views" value="10000" /><span class="wymagane">*</span></td></tr>
          <tr><td><label for="description">Opis jednostki: </label></td><td><textarea name="description" id="description" cols="30" rows="7"></textarea></td></tr>
            <tr><td></td><td><button type="submit" style="vertical-align:middle;" name="AddAdvertisementOK">Dodaj reklamę</button></td></tr>

        </table>
      </div>
     </form>
   </div>
   ');
  }


    echo('
    <br /><br /><br /><a href="'.$path['admin_panel'].'" class="button_normal">Powrót do panelu administracyjnego</a>');

   ?>

      <br style="clear:both;" />

    </div>
  </div>

<?php include_once($footer); ?>