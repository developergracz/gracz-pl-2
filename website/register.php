<?php include("variables_local.php"); include_once($header); ?>

  <div class="box light" id="window_register">
    <div class="corner top left"></div>
    <div class="corner bottom left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom right"></div>
    <div class="border top"></div>
    <div class="border bottom"></div>
    <div class="border left"></div>
    <div class="border right"></div>
    <div class="content">
    
      <h1>Rejestracja</h1>
            
      <?php
        $account_created = false;
        
        if (isset($_POST['buttonRegister']))
        {
          try {
            CreateAccount($_POST['login'], $_POST['email'], $_POST['password'], $_POST['password_confirmation'], $_POST['sex']);
            echo('<div class="positive"><img src="'.$directory['design'].'icon_letter.png" alt="" width="16" />&nbsp;&nbsp;Twoje konto zostało utworzone. Na podany adres e-mail został wysłany link aktywujący konto - prosimy o jego kliknięcie aby dokończyć proces rejestracji.</div><br /><br /><a href="'.$directory['base'].'index.php">Strona główna</a>');
            $account_created = true;
          }catch(Exception $e){
            echo($e);
          }
        }
      ?>
      
      <?php
        $default_login = trim(htmlspecialchars($_POST['login']));
        if ($default_login=='') $default_login = 'Wpisz login';
        $default_email = trim(htmlspecialchars($_POST['email']));
        if ($default_email=='') $default_email = 'twój@e-mail.pl';
        $default_sex = intval($_POST['sex']);
        if ($default_sex == 0) $default_sex = SEX_MALE;
        
      
        if (!$account_created)
        {
      ?>
      
      
      <form action="#" method="post" class="uniform_labels validate register">
      <fieldset>
        <p>
          <label for="register_email">E-mail:</label>
          <input type="email" name="email" id="register_email" value="<?php echo($default_email); ?>" data-validation="email" />
        </p>
        <p>
          <label for="register_login">Login:</label>
          <input type="text" name="login" id="register_login" value="<?php echo($default_login); ?>" data-validation="alphanumeric length" data-validation-allowing="_" data-validation-length="min4" data-validation-error-msg="Login musi mieć przynajmniej 4 znaki i składać się z liter, cyfr lub znaku podkreślenia." />
        </p>
        <p>
          <label for="register_password_confirm">Hasło:</label>
          <input name="password_confirmation" id="register_password_confirm" type="password" data-validation="length" data-validation-length="min6">

          <br />
          <label for="register_password">Potwierdź hasło:</label>
          <input name="password" type="password" id="register_password" data-validation="confirmation" data-validation-strength="1">
        </p>
        <p>
          <label for="register_sex">Płeć:</label>
          <span id="register_sex">          
            <input type="radio" id="radio_sex_female" name="sex" value="<?php echo(SEX_FEMALE); ?>" <?php echo($default_sex==SEX_FEMALE?'checked="checked"':''); ?>>
            <label for="radio_sex_female"><img src="<?=$directory['design']; ?>icon_female.png" alt="F" height="20" /><span>Kobieta</span></label>
            <input type="radio" id="radio_sex_male" name="sex" value="<?php echo(SEX_MALE); ?>" <?php echo($default_sex==SEX_MALE?'checked="checked"':''); ?>>
            <label for="radio_sex_male"><img src="<?=$directory['design']; ?>icon_male.png" alt="M" height="20" /><span>Mężczyzna</span></label>
          </span>

        </p>

        <p>
          <input type="checkbox" name="register_accept_terms" id="register_accept_terms" />
          <label for="register_accept_terms">Akceptuję warunki <strong><a href="<?php echo($path['terms_of_service']); ?>" target="_blank">regulaminu</a></strong> oraz zgadzam się z <strong><a href="<?php echo($path['privacy_policy']); ?>" target="_blank">polityką poprawności</a></strong>.</label>
        </p>
        
        <button type="submit" name="buttonRegister">Zarejestruj</button>
        </fieldset>
      </form>
      
      <script type="text/javascript">
      jQuery(document).ready(function (){
        jQuery("#register_sex").buttonset();
      });
      
      </script>
      
      
<!--      <div style="position:absolute; right:4%; top:45%; width:60%;">
      Rejestracja daje Ci możliwość wzięcia udziału we wspaniałej, emocjonującej rozgrywce online. Graj z innymi, zdobywaj punkty i stań się najlepszym graczem!<br /><br />
      </div>
    -->  
      <?php
      }
      ?>
      
      
    </div>
  </div>
  
<?php include_once($footer); ?>