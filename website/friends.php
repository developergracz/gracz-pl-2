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

    <?php
      if (isset($_REQUEST['add_friend_id'])&&isset($_REQUEST['token']))
      {
        echo('<h1>Dodaj do znajomych</h1>');
        try
        {
          AddToFriendList($_REQUEST['add_friend_id'], $_REQUEST['token']);
          echo('<div class="positive">Wskazany użytkownik został dodany do znajomych.</div>');
          
          // RedirectJavaScript($path['friends'],2);
        }catch (Exception $e)
        {
          echo('<div class="negative">'.$e->getMessage().'</div>');
        }
        echo('
        <br />
        <a href="'.$path['profile'].'" class="button_normal">Twój profil</a>
        <a href="'.$path['friends'].'" class="button_normal">Pokaż listę znajomych</a>
        ');
      }elseif (isset($_REQUEST['delete_friend_id'])&&isset($_REQUEST['token']))
      {
        echo('<h1>Usuń ze znajomych</h1>');
        try
        {
          DeleteFromFriendList($_REQUEST['delete_friend_id'], $_REQUEST['token']);
          echo('<div class="positive">Wskazany użytkownik został usunięty z listy znajomych.</div>');
          
          // RedirectJavaScript($path['friends'],2);
        }catch (Exception $e)
        {
          echo('<div class="negative">'.$e->getMessage().'</div>');
        }
        echo('
        <br />
        <a href="'.$path['profile'].'" class="button_normal">Twój profil</a>
        <a href="'.$path['friends'].'" class="button_normal">Pokaż listę znajomych</a>
        ');
      
      }else{
        echo('<h1>Twoi znajomi</h1>');
        try
        {
          DisplayFriendList($_REQUEST['id_user']);
        }catch (ExceptionNoResults $e)
        {
          echo('<div class="information">Nie masz żadnych znajomych.</div>');
        }

        echo('
        <br />
        <br />
        <a href="'.$path['profile'].'" class="button_normal">Twój profil</a>
        ');
      }
    ?>
                  
    </div>
  </div>
	
<?php include_once($footer); ?>