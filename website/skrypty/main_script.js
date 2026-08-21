var periodOfFreshInvitationsInMinutes = 5;
var invitationsDownloadIntervalInMiliseconds = 2000;

jQuery(document).ready(function ()
{
    if (!paths)
    {
      if (console)
        console.log("Zmienna paths (przechowująca ścieżki plików) nie została zadeklarowana w przestrzeni globalnej.");
    }

    jQuery("input").clearField();
    jQuery.validate(
    {

        language : jquery_form_validator_localisation,
        modules : 'security',
        onModulesLoaded : function()
        {
            var optionalConfig =
            {
                fontSize: '12pt',
                padding: '4px',
                bad : 'Bardzo słabe',
                weak : 'Słabe',
                good : 'Wystarczające',
                strong : 'Mocne'
            }
            ;
            jQuery('.register input[name="password"]').displayPasswordStrength(optionalConfig);
        }
    }
    );

    jQuery(document).tooltip();

    // Scrolling to the path element
    if (jQuery("#path").length==1)
    {
        jQuery("html, body").animate(
        {
            scrollTop: jQuery("#path").offset().top
        }
        , 2000);
    }


    // initiate invitations support
    setInterval(function () { invitationsDownload(false); }, invitationsDownloadIntervalInMiliseconds);
    invitationsDownload(false);
    jQuery("#numberOfInvitations").hide();

    initiateControlsEvents();
}
);

function dump(arr,level)
{
    var dumped_text = "";
    if(!level) level = 0;

    //The padding given at the beginning of the line.
    var level_padding = "";
    for(var j=0;j<level+1;j++) level_padding += "    ";

    if(typeof(arr) == "object")
    {
        //Array/Hashes/Objects
        for(var item in arr)
        {
            var value = arr[item];

            if(typeof(value) == "object")
            {
                //If it is an array,
                dumped_text += level_padding + "\'" + item + "\' ...\n";
                dumped_text += dump(value,level+1);
            } else if (typeof(value) == "function")
            {
                // dumped_text += level_padding + "\'" + item + "\' => \" (funkcja) \"\n";
            } else
            {
                dumped_text += level_padding + "\'" + item + "\' => \"" + value + "\"\n";
            }
        }
    } else
    {
        //Stings/Chars/Numbers etc.
        dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
    }

    if (console)
      console.log(dumped_text);

    return dumped_text;
}

function initiateControlsEvents()
{
    // Add to friends
    jQuery(".friends").unbind().click(function (){
      var requestData = {
        "action": (jQuery(".friends").hasClass("button_normal")?"add":"remove"),
        "id_user": jQuery(this).attr('data-id_user'),
        "token": jQuery(this).attr('data-token')
      };

      jQuery.getJSON(paths.ajax.friends,
          requestData,
          function (msg) {
            if (msg.state=="added")
            {
              jQuery(".friends").removeClass("button_normal").addClass("button_hot").text("Usuń ze znajomych");
            }else if (msg.state=="removed")
            {
              jQuery(".friends").removeClass("button_hot").addClass("button_normal").text("Dodaj do znajomych");
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd", msg.message);
            }
          }
      );
      return false;
    });
    // End of add to friends

    // Add to blacklist
    jQuery(".blacklist").unbind().click(function (){
      var requestData = {
        "action": (jQuery(".blacklist").hasClass("button_normal")?"block":"unblock"),
        "id_user": jQuery(this).attr('data-id_user'),
        "token": jQuery(this).attr('data-token')
      };

      jQuery.getJSON(paths.ajax.blacklist,
          requestData,
          function (msg) {
            if (msg.state=="blocked")
            {
              jQuery(".blacklist").removeClass("button_normal").addClass("button_hot").text("Odblokuj");
            }else if (msg.state=="unblocked")
            {
              jQuery(".blacklist").removeClass("button_hot").addClass("button_normal").text("Zablokuj");
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd", msg.message);
            }
          }
      );
      return false;
    });
    // End of add to blacklist

    // Read invitations
    jQuery("#icon_invitations img, #numberOfInvitations").unbind().click(function (){
        invitationsDownload(false);
        jQuery("#icon_invitations .list").slideToggle("slow");
    });
    // End of read invitations

    // Reset advertisement views counter
    jQuery(".resetAdvertisementViews").unbind().click(function (){
      var requestData = {
        "action": "reset",
        "id_advertisement": jQuery(this).attr('data-advertisement_id'),
        "token": jQuery(this).attr('data-token')
      };

      jQuery.getJSON(paths.ajax.advertisements,
          requestData,
          function (msg) {
            if (msg.state=="reseted")
            {
              MessageBox("Operacja wykonana", "Pomyślnie zresetowano ilość pozostałych wyświetleń reklamy.", true, function () { location.reload(); });
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd",msg.message);
            }
          }
      );
      return false;
    });
    // End: Reset advertisement views counter

    // Change advertisement purchased views
    jQuery(".changeAdvertisementPurchasedViews").unbind().click(function (){            var new_purchased_views = prompt("Wprowadź łączną liczbę wykupionych wyświetleń.", jQuery(this).attr('data-purchased_views'));

      if (!new_purchased_views) return false;
      if (new_purchased_views<=0)
      {
        MessageBox("Błędne dane", "Wprowadzono zerową lub ujemną liczbę wykupionych wyświetleń.");
        return false;
      }


      var requestData = {
        "action": "change_purchased_views",
        "id_advertisement": jQuery(this).attr('data-advertisement_id'),
        "purchased_views": new_purchased_views,
        "token": jQuery(this).attr('data-token')
      };

      jQuery.getJSON(paths.ajax.advertisements,
          requestData,
          function (msg) {
            if (msg.state=="changed")
            {
              MessageBox("Operacja wykonana", "Pomyślnie zmieniono ilość wykupionych wyświetleń reklamy.", true, function () { location.reload(); });
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd",msg.message);
            }
          }
      );
      return false;
    });
    // End: Change advertisement purchased views

    // Change advertisement remaining views
    jQuery(".changeAdvertisementRemainingViews").unbind().click(function (){            var new_remaining_views = prompt("Wprowadź liczbę pozostałych wyświetleń.", jQuery(this).attr('data-remaining_views'));

      if (!new_remaining_views) return false;
      if (new_remaining_views<=0)
      {
        MessageBox("Błędne dane", "Wprowadzono zerową lub ujemną liczbę pozostałych wyświetleń.");
        return false;
      }

      var requestData = {
        "action": "change_remaining_views",
        "id_advertisement": jQuery(this).attr('data-advertisement_id'),
        "remaining_views": new_remaining_views,
        "token": jQuery(this).attr('data-token')
      };

      jQuery.getJSON(paths.ajax.advertisements,
          requestData,
          function (msg) {
            if (msg.state=="changed")
            {
              MessageBox("Operacja wykonana", "Pomyślnie zmieniono ilość pozostałych wyświetleń reklamy.", true, function () { location.reload(); });
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd",msg.message);
            }
          }
      );
      return false;
    });
    // End: Change advertisement remaining views


    // Invite user to gameplay
    var invited_login = '';
    jQuery('.inviteToGameplay').click(function (){
      var requestData = {
        "action": "send",
        "id_user_recipient": jQuery(this).attr('data-id_invited_user'),
        "message": "Hej, zapraszam Cię do gry...",
        "token": jQuery(this).attr('data-token')
      };
      invited_login = jQuery(this).attr('data-login_invited_user');

      jQuery.getJSON(paths.ajax.conversation,
          requestData,
          function (msg) {
            if (msg.state=="sent")
            {
              location.href = paths.conversation+"-"+invited_login;
            }else if (msg.state=="error")
            {
              MessageBox("Wystąpił błąd",msg.message);
            }
          }
      );
      return false;
    });
    // End: Invite user to gameplay



    // "New conversation" form support
    jQuery('.form_new_conversation').submit(function (){
      default_value = jQuery(this.conversation_interlocutor).attr('data-default_value').valueOf();

      if ((this.conversation_interlocutor.value.length>0)&&(this.conversation_interlocutor.value.valueOf() != default_value ))
      {
        location.href = paths.conversation + "-" + this.conversation_interlocutor.value;
      } else {
        this.conversation_interlocutor.style.color = "red";
        MessageBox("Wprowadź nazwę gracza", "Wpisz nazwę gracza z którym chcesz przeprowadzić rozmowę.");
      }

      return false;
    });
    jQuery('.form_new_conversation input[type=text]').keydown(function (){
        this.style.color = "inherit";
    });
    // End: "New conversation" form support

    // Manage room button
    jQuery("#manage_room_button").click(function (){
      jQuery("#manage_room_container").slideToggle();
      return false;
    });
    // End: Managr room button

}

function invitationsDownload(setAsRead, onSuccessCallback)
{
    console.log("Getting invitations...");

    jQuery.getJSON(paths.ajax.invitations,
        {
            action: "getInvitations",
            setAsRead: setAsRead?1:0
        },
        function (data) {
            if (data.state!="error")
            {
                jQuery("#icon_invitations .list").empty();

                var notReadCount = 0;
                for (var i=0; i<data.invitations.length; i++)
                {
                    var li = jQuery('<li></li>');
                    li.append("<div class=\"title\">Zaproszenie do "+data.invitations[i].translatedZoneName+" od "+data.invitations[i].login_sender+"<span class=\"date\">"+data.invitations[i].date+"</span></div>Gracz <a href=\""+paths.profile+"?profile-"+data.invitations[i].login_sender+"\">"+data.invitations[i].login_sender+"</a> zaprasza Cię do gry "+data.invitations[i].translatedZoneName+", do pokoju <b>"+data.invitations[i].room_name+"</b>. Kliknij, aby przyjąć zaproszenie...");
                    li.attr('data-id_invitation',data.invitations[i].id_invitation);
                    li.attr('data-id_game',data.invitations[i].id_game);
                    li.attr('data-id_category',data.invitations[i].id_category);
                    li.attr('data-room_name',data.invitations[i].room_name);
                    if (data.invitations[i].is_read==0)
                        li.addClass("notRead");
                    li.click(function (){
                        li.removeClass("notRead");
                        setInvitationAsRead(jQuery(this).attr('data-id_invitation'), function (){
                            location.href = paths.games+'?id_category='+jQuery(li).attr('data-id_category')+'&id_game='+jQuery(li).attr('data-id_game')+'&roomName='+jQuery(li).attr('data-room_name');
                        });
                    });
                    jQuery("#icon_invitations .list").append(li);

                    notReadCount += (data.invitations[i].is_read==0?1:0);

                    if (data.invitations[i].is_read==0) {
                        // If invitation was sent for last 5 minutes then we show dialog box
                        var dateInvitation = new Date(data.invitations[i].date);
                        var dateNow = new Date();
                        if ((dateNow - dateInvitation) / 1000 / 60 < periodOfFreshInvitationsInMinutes) {
                            openInvitationMessageBox(data.invitations[i].id_invitation,
                                data.invitations[i].login_sender,
                                data.invitations[i].id_category,
                                data.invitations[i].id_game,
                                data.invitations[i].translatedZoneName,
                                data.invitations[i].room_name
                            );
                        }
                    }
                }
                jQuery("#numberOfInvitations").text(notReadCount);
                if (notReadCount==0)
                {
                    jQuery("#numberOfInvitations").fadeOut();
                }else{
                    jQuery("#numberOfInvitations").fadeIn();
                }
            }else{
                console.log(data.message);
                jQuery("#icon_invitations .list").html(data.message);
            }

            if (onSuccessCallback)
                onSuccessCallback();
        }
    );
}

function openInvitationMessageBox(id_invitation, username, id_category, id_game, game_name, room_name)
{
    // if there has been opened invitation message box already then dont open next one
    if (jQuery(".invitation_message_container").length>0) return;

    var box = jQuery("<div></div>");
    box.addClass("box light invitation_message_container");
    box.attr('data-id_invitation', id_invitation);
    box.attr('data-id_category', id_category);
    box.attr('data-id_game', id_game);
    box.attr('data-room_name', room_name);

    box.append('<div class="corner top left"></div><div class="corner bottom left"></div><div class="corner top right"></div><div class="corner bottom right"></div><div class="border top"></div><div class="border bottom"></div><div class="border left"></div><div class="border right"></div><div class="content"></div>');
    var content = box.find('.content');
    content.append('Gracz <span class="username">'+username+'</span> zaprasza Cię do gry w <span class="game_name">'+game_name+'</span>');
    content.append('<hr />');

    var buttonAccept = jQuery('<a href="#">Akceptuj</a>');
    buttonAccept.addClass("accept");
    buttonAccept.click(function (){
        var invitationWindow = jQuery(".invitation_message_container");
        setInvitationAsRead(invitationWindow.attr('data-id_invitation'));
        location.href = paths.games+'?id_category='+jQuery(invitationWindow).attr('data-id_category')+'&id_game='+jQuery(invitationWindow).attr('data-id_game')+'&roomName='+jQuery(invitationWindow).attr('data-room_name');
        jQuery(".invitation_message_container").empty().remove();
    });

    var buttonCancel = jQuery('<a href="#">Odrzuć</a>');
    buttonCancel.addClass("cancel");
    buttonCancel.click(function (){
        jQuery(".invitation_message_container").effect("drop", 400);
        setInvitationAsRead(jQuery(".invitation_message_container").attr('data-id_invitation'));
        jQuery(".invitation_message_container").empty().remove();
    });

    var buttonDiv = jQuery("<div>");
    buttonDiv.addClass("buttons");
    buttonDiv.append(buttonAccept);
    buttonDiv.append(buttonCancel);
    content.append(buttonDiv);

    jQuery(document.body).append(box);
}

function setInvitationAsRead(id_invitation, onSuccess)
{
    jQuery.getJSON(paths.ajax.invitations,
        {
            action: "setInvitationAsRead",
            id_invitation: id_invitation
        },
        function (data) {
            if (data.state!="error")
            {
                if (onSuccess)
                    onSuccess();
            }
        }
    );
}

function MessageBox(tytul,tresc,modalne,onclose,ontak,onnie)
{
    if (modalne==undefined)
    {
        modalne = true;
    }

    var tablica_przyciskow = new Array();
    tablica_przyciskow = [
    {
        text: "Tak", click: ontak
    }
    ,
    {
        text: "Nie", click: onnie
    }
    ];
    if ((ontak==undefined)&&(onnie==undefined))
    {
        tablica_przyciskow = [
        {
            text: "OK", click: function()
            {
                jQuery(this).dialog("close");
            }
        }
        ];
    }

    var obj = jQuery("<div></div>");
    obj.attr("title",tytul);
    return obj.dialog(
    {
        modal: modalne,
        show: "fade",
        bgiframe: false,
        closeText: "Zamknij",
        buttons: tablica_przyciskow,
        close: onclose,
        closeOnEscape: true
    }
    ).html(tresc);
}


var jquery_form_validator_localisation =
{
    errorTitle : 'Wysyłanie formularza nie powiodło się.',
    requiredFields : 'Nie wypełniłe(a)ś wszystkich wymaganych pól.',
    badTime : 'Wprowadzony czas jest nieprawidłowy.',
    badEmail : 'Podany adres e-mail jest nieprawidłowy.',
    badTelephone : 'Podany numer telefonu jest nieprawidłowy.',
    badSecurityAnswer : 'Nie podałeś odpowiedzi na sekretne pytanie.',
    badDate : 'Wprowadzona data jest nieprawidłowa.',
    lengthBadStart : 'Musisz podać odpowiedź zawierającą do ',
    lengthBadEnd : ' znaków.',
    lengthTooLongStart : 'Podałeś odpowiedź dłuższą niż ',
    lengthTooShortStart : 'Wprowadziłeś tekst krótszy niż ',
    notConfirmed : 'Podane hasła nie pasują do siebie.',
    badDomain : 'Nieprawidłowa nazwa domeny',
    badUrl : 'Wprowadzony adres URL jest nieprawidłowy.',
    badCustomVal : 'Podałeś nieprawidłową odpowiedź.',
    badInt : 'Odpowiedź, którą podałeś, nie jest prawidłową liczbą.',
    badSecurityNumber : 'Wprowadzony numer ubezpieczenia jest nieprawidłowy.',
    badUKVatAnswer : 'Wprowadzony UK VAT numer jest nieprawidłowy.',
    badStrength : 'Wprowadzone hasło nie jest wystarczająco silne.',
    badNumberOfSelectedOptionsStart : 'Musisz wybrać przynajmniej ',
    badNumberOfSelectedOptionsEnd : ' odpowiedzi.',
    badAlphaNumeric : 'Wprowadzona odpowiedź może zawierać tylko znaki alfanumeryczne ',
    badAlphaNumericExtra: ' i ',
    wrongFileSize : 'Plik, który próbujesz załadować jest zbyt duży.',
    wrongFileType : 'Plik, który próbujesz załadować ma nieprawidłowy format.',
    groupCheckedRangeStart : 'Proszę wybrać między ',
    groupCheckedTooFewStart : 'Proszę wybrać przynajmniej ',
    groupCheckedTooManyStart : 'Proszę wybrać maksymalnie ',
    groupCheckedEnd : ' pozycji.'
}
;