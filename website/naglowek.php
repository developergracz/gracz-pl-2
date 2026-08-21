<?php
include_once("variables_local.php");
include_once("../variables_global.php");

  if (!file_exists($path['library_main']))
  {
    header('Content-Type: text/html; charset=UTF-8;');
    echo('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'."\r\n");
    echo('<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pl">'."\r\n");
    echo('<head><title>Przerwa techniczna</title><meta http-equiv="Content-Type" content="application/xhtml+xml; charset=UTF-8;" /></head>'."\r\n");
    echo('<body>'."\r\n");
    echo('<div style="font-size:30pt; position:fixed; *position:absolute; left:0px; top:0px; width:100%; height:100%; background-color: #8FB717; color: white; text-align:center; padding-top:10pt; text-shadow: black 0px -0px 6px; z-index:5;">Przerwa techniczna. Serwis chwilowo nieczynny.</div>');
    echo('</body></html>');
    exit();
  }

include_once("wykonanie_procedur_startowych.php");

echo('<!DOCTYPE html>'."\r\n");
echo('
<head>
<link rel="shortcut icon" href="'.$directory['design'].'ikona.png" />
<link rel="stylesheet" type="text/css" href="'.$path['css_stylesheet_jquery'].'" />
<!--[if lt IE 10]>
<link rel="stylesheet" type="text/css" href="'.$path['css_stylesheet'].'" />
<![endif]-->

<link rel="stylesheet" type="text/css" media="only screen and (min-width:481px)" href="'.$path['css_stylesheet'].'" />
<link rel="stylesheet" type="text/css" media="only screen and (max-width:480px)" href="'.$path['css_stylesheet_smallscreen'].'" />


<link href="http://fonts.googleapis.com/css?family=Open+Sans&amp;subset=latin,latin-ext" rel="stylesheet" type="text/css">
<link href="http://fonts.googleapis.com/css?family=Titillium+Web:400,700,300,700italic,600,600italic,900,200,200italic,400italic,300italic&amp;subset=latin,latin-ext" rel="stylesheet" type="text/css">

<!-- Meta-dane HTML -->
<meta charset="utf-8" />
<meta name="author" content="Czesław Socha"/>
<meta name="keywords" content="gry online warcaby gomoku 5 krzyżyków zagraj multiplayer flash"/>
<meta name="description" content="'.$service_name.'"/>
<meta name="revisit-after" content="4 days" />
<meta name="robots" content="index,follow"/>
<meta name="rating" content="General" />
<meta name="viewport" content="initial-scale=1.0, user-scalable=no" />

<title>'.$service_name.'</title>

<script src="'.$directory['scripts'].'jquery-1.9.1.min.js"></script>
<script src="'.$directory['scripts'].'jquery-ui-1.10.3.custom.min.js"></script>
<script src="'.$directory['scripts'].'jquery.form-validator.min.js"></script>
<script src="'.$directory['scripts'].'jquery.cookie.js"></script>
<script type="text/javascript" src="https://www.google.com/jsapi"></script>
<script type="text/javascript" src="'.$directory['scripts'].'sfs2x-api.js"></script>
<script type="text/javascript" src="'.$directory['scripts'].'jquery.clearfield.js"></script>
<script type="text/javascript" src="'.$directory['scripts'].'jquery.scrollTo.min.js"></script>
<script src="'.$directory['scripts'].'main_script.js"></script>
<script src="'.$directory['scripts'].'jquery.chatsupport.js"></script>

 <script type="text/javascript">
  var paths = {
    conversation : "'.$path['conversation'].'",
    profile : "'.$path['profile'].'",
    games : "'.$path['games'].'",
    ajax : {
      friends : "'.$path['ajaxFriends'].'",
      blacklist : "'.$path['ajaxBlacklist'].'",
      advertisements : "'.$path['ajaxAdvertisements'].'",
      conversation : "'.$path['ajaxConversation'].'",
      invitations: "'.$path['ajaxInvitations'].'"
    }
  };

  ');

  if (isset($_SESSION['initiated']))
  {
  echo('
  jQuery(document).chatsupport({
      service_name: "'.$service_name.'",
      play_new_message_sound: '.($_SESSION['play_new_message_sound']==1?"true":"false").',
      show_desktop_notifications: '.($_SESSION['show_desktop_notifications']==1?"true":"false").',
      conversations_checking_period_normal: '.$conversations_checking_period_normal.',
      conversations_checking_period_lazy: '.$conversations_checking_period_lazy.',
      no_notification_support_container: jQuery("#notifications_container"),
      id_user: '.$_SESSION['id'].',
      token: "'.$_SESSION['token'].'",
      folder: {
        design: "'.$directory['design'].'"
      }
      ,
      path: {
        conversation: "'.$path['conversation'].'",
        profile: "'.$path['profile'].'",
        ajax: {
          conversation: "'.$path['ajaxConversation'].'",
        }
      }
  });
  ');
  }

  echo('
 </script>
');


// Pasting tracking code or advertisement system code in HEAD section
CodePasteDisplay(CODE_PASTE_HEAD);

echo('
</head>
<body>

<div class="strona">
');


// Cookies alert support
if (isset($_POST['acceptCookies']))
{
  setCookie('cookiesAccepted','1',time()+12*30.5*24*60*60,'/');
}

if ($_COOKIE['cookiesAccepted']!=1)
{
  echo('
  <div class="cookies">Nasz serwis wykorzystuje pliki cookies. Korzystanie z witryny oznacza zgodę na ich zapis lub odczyt. Możesz wyłączyć pliki cookies <a href="http://jakwylaczyccookie.pl/">w ustawieniach Twojej przeglądarki</a> - w takim przypadku jednak nie będziemy mogli zapewnić poprawnego działania serwisu. Jeśli chcesz się dokładnie dowiedzieć <a href="'.$path['privacy_policy'].'">do czego wykorzystujemy ciasteczka, zajrzyj tutaj</a>. <form method="post" onsubmit="jQuery.cookie(\'cookiesAccepted\',\'1\', { expires: 365, path: \'/\'}); jQuery(this).parent().slideUp(); return false;"><button type="submit" name="acceptCookies">Akceptuję</button></form></div>
  ');
}
// End: Cookies alert support

echo('
<header>
  <div id="box_logo" class="box light">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
      <a href="'.$service_base_address.'"><img src="'.$directory['design'].'logo_nazwa.png" alt="Serwis gracz" /></a>
      <img src="'.$directory['design'].'logo.png" alt="" id="logo_graphic"/><br />
      <span class="opis_serwisu">Gry online multiplayer bez pobierania</span>
      <hr />
      <div class="zacheta_do_grania">Zagraj z innymi i udowodnij, że jesteś lepszym graczem!</div>
    </div>
  </div>

  <div id="box_crown">
    <img src="'.$directory['design'].'gold_crown.png" alt="" />
  </div>

  <div id="box_login" class="box light">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
    ');

      $stats = getServiceStatistics();
      if (($_SESSION['account_type']>0)&&(basename($_SERVER['SCRIPT_NAME'])!=basename($path['logout'])))
      {
        echo('<div class="loggedAs">Witaj <a href="'.$path['profile'].'">'.$_SESSION['login'].'</a></div>');
        echo('<hr />');
        echo('<div id="loggedUserOnlineUsersAndLogout">
                <span style="cursor:pointer" onclick="location.href=\''.$path['online_users'].'\'">'.$stats['number_of_online_users'].' graczy online</span>
                <div id="icon_invitations">
                  <img src="'.$directory['design'].'icon_invitations.png" height="28" title="Otrzymane zaproszenia" />
                  <div id="numberOfInvitations" title="Ilość otrzymanych zaproszeń">0</div>
                  <ul class="list"></ul>
                </div>
                <a class="button_normal" style="float:right" href="'.$path['logout'].'">Wyloguj</a>
              </div>');

        echo('
        <div class="links">
          <a href="'.$path['games'].'">gry</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['tournaments'].'">turnieje</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['rank'].'">ranking</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['help'].'">pomoc</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['attentions'].'">uwagi</a>
          <span class="vertical_spacer">|</span>
        ');

        if ($_SESSION['account_type'] >= ADMINISTRATOR)
        {
          echo('<a href="'.$path['admin_panel'].'" style="color:red">admin</a>');
        }else{
          echo('
            <a href="'.$path['contact'].'">kontakt</a>
          ');
        }
        echo('
        </div>
        ');
      }else
      {
        echo('<div id="login_form_and_registration_buttons">');
        DisplayFormLogin(true);
        echo('
          <button name="buttonFacebookRegister" class="button_cold" onclick="location.href=\''.$service_base_address.$path['facebook_registration'].'?facebookRegister\';"><img src="'.$directory['design'].'ikona_facebook.png" alt="" />Zarejestruj się przez Facebook</button>

          <a href="'.$path['register'].'" class="button_hot">Załóż konto za darmo</a>
        </div>

        <div class="links">
          <a href="'.$path['help'].'">pomoc</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['attentions'].'">uwagi</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['contact'].'">kontakt</a>
          <a href="'.$path['remember_password'].'" class="rememberPassword">nie pamiętam hasła</a>
        </div>

        <hr />

        <div class="links">
          <span class="statystyka_portalu" onclick="location.href=\''.$path['statystyka_portalu'].'\'">
            <!--<span class="usersCount">'.$stats['number_of_all_users'].'</span>-->

            <a href="'.$path['statistics'].'"><span class="playersOnline">'.$stats['number_of_online_users'].'</span> <span class="playersOnlineLabel">graczy online</span></a>
          </span>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['games'].'">gry</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['tournaments'].'">turnieje</a>
          <span class="vertical_spacer">|</span>
          <a href="'.$path['rank'].'">ranking</a>
        </div>
        ');
      }
      echo('
    </div>

  </div>
  ');

echo('
</header>
');

AdvertisementsDisplay(ADVERTISEMENT_MAIN);

if ($komunikat_logowania!='')
{
  echo('
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


          <div class="negative">
          '.$komunikat_logowania.'
          </div>

        <br style="clear:both;" />

      </div>
    </div>
    <br style="clear:both;" />
  ');
}else if (isset($_POST['buttonLogin']))
{ // Jeśli próba logowania nie powiodła się
  if ($_SESSION['account_type']<USER)
  {
    echo('
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

          <div class="negative">
          <p><strong>Podałeś błędny login lub hasło.</strong></p>
          <p>
          Proszę spróbować ponownie zalogować się z danymi jakie podałeś podczas rejestracji.
          Jeżeli zapomniałeś swojego loginu i/lub hasła skorzystaj z opcji <a href="'.$path['remember_password'].'">Zapomnialem
          loginu i hasła</a>.
          Wpisz swój adres e-mail, który podałeś podczas rejestracji. Jeśli będzie prawidłowy, na wskazany
          adres prześlemy Ci Twój login i nowe hasło.
          </p>
          <p>
          Jeśli podane powyżej czynności nie pomogły w rozwiązaniu problemu, napisz do nas w tej sprawie korzystajac z poniższego formularza kontaktowego.
          </p>

          <button onclick="location.href=\''.$path['contact'].'\'">Skontaktuj się z nami</button>
          <br /><br />

        </div>

        <br style="clear:both;" />

      </div>
    </div>
    <br style="clear:both;" />
    ');
  }
}

echo('
<nav>
');

  GryWyswietlKategorie();

echo('
</nav>


<article>

');
?>