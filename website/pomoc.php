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
      <h1>Pomoc</h1>
<?php
  
  if (isset($_GET['id_game']))
  {
    GryWyswietlOpisGry($_GET['id_game']);  
  }else
  {
    echo('
    <ol>
      <li><h3>Nie mogę się zalogować. Co robić?</h3>
      <p>Mogą być dwie przyczyny takiego stanu. Twoje konto może nie być aktywne (należy je wtedy aktywować klikając link w wysłanej przez nas wiadomości e-mail) lub możesz nie pamiętać hasła do niego. Jeśli list aktywacyjny do Ciebie nie dotarł, możesz poprosić o <a href="'.$path['activate_account'].'">ponowne jego wysłanie</a>. Natomiast jeśli nie pamiętasz hasła, <a href="'.$path['remember_password'].'">wygeneruj nowe hasło</a> - prześlemy je wraz z linkiem aktywującym na adres email podany przez Ciebie przy rejestracji.</p>
      </li>

      <li><h3>Nie doszedł do mnie list z linkiem aktywującym konto</h3>
      <p>Jeśli list aktywacyjny do Ciebie nie dotarł, możesz poprosić o <a href="'.$path['activate_account'].'">ponowne jego wysłanie</a>.
      </li>
      
      <li><h3>Zapomniałem hasła</h3>
      <p>Jeśli nie pamiętasz hasła, możesz <a href="'.$path['remember_password'].'">wygenerować nowe hasło</a>. W takim przypadku system prześle na Twój adres email (podany przy rejestracji) nowowygenerowane hasło wraz z linkiem, który je aktywuje. Link aktywujący hasło jest niezbędny, aby nikt postronny nie zaczął zmieniać hasła bez Twojej wiedzy.</p>
      </li>

      <li><h3>Mam kłopoty z połączeniem podczas gry</h3>
      <p>Dokładamy wszelkich możliwych starań aby zapewnić płynne gry. Nie zawsze jednak problem leży po naszej stronie. Jeśli czas reakcji gry jest duży, występują spore opóźnienia, prosimy sprawdzić czy w Państwa sieci domowej nie jest uruchomione oprogramowanie mocno obciązające sieć - np. program do pobierania Torrentów lub inne programy P2P. Potrafią one czasami tak zapchać router, że wydłuża się czas przekazywania przez niego pakietów do sieci zewnętrznej (Internetu).<br />
      Jeśli uważasz, że problem leży po naszej stronie, bardzo prosimy o <a href="'.$path['contact'].'">wysłanie nam wiadomości</a><br />
      </p>
      </li>
      
      <li><h3>Czy będąc za Firewallem mogę grać w Wasze gry?</h3>
      <p>W zdecydowanej większości przypadków tak. Korzystamy z oprogramowania tunelującego nasze protokoły w protokole HTTP. W przypadku gdy wykryty zostanie Firewall, nasze oprogramowanie przełączy się na tryb pozwalający na ominięcie go.<br />
      Jest jeden warunek - Twoja sieć musi pozwalać na połączenia ze stronami WWW (jeśli możesz wczytać naszą stronę przez przeglądarkę internetową - będzie dobrze :)
      </p>
      </li>
    
    </ol>
    ');
  }
?>
    </div>
  </div>  

<?php include_once($footer); ?>