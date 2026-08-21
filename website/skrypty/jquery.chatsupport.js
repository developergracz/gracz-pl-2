(function($)
{

  var settings;
  var conversation_sound_notification;
  var checking_conversation = false;
  var notificationObject = null;
  var global_last_message_id = 0;
  var conversation_timer = null;
  var conversations_checking_period_normal = 1000*4;
  var conversations_checking_period_lazy = 1000*13;
  var last_date = 0;

  jQuery.fn.chatsupport = function(options)
  {

    settings = jQuery.extend(
    {
      title: "Funkcje używane w pluginie chata.",
      service_name: "Strona",
      play_new_message_sound:true,
      show_desktop_notifications: true,
      conversations_checking_period_normal: 1000*4,
      conversations_checking_period_lazy: 1000*13,
      no_notification_support_container: this,
      id_user: 0,
      folder:
      {
        design: ""
      }
      ,
      path:
      {
        conversation: "",
        ajax:
        {
        }
      }
    }, options);


    jQuery(document).ready(function ()
    {
      jQuery.fn.chatsupport.initControls();

      // At the document ready, we are activating focus on text field
      jQuery("#conversation_message").focus();

      // Set and run new message checking
      jQuery.fn.chatsupport.changeConversationCheckingPeriod(conversations_checking_period_normal);
      jQuery.fn.chatsupport.refreshConversation();
    });

  }

  jQuery.fn.chatsupport.initControls = function()
  {
    jQuery.fn.chatsupport.createAudioPlayer();
    jQuery(window).focus(jQuery.fn.chatsupport.onWindowFocus);
    jQuery(window).blur(jQuery.fn.chatsupport.onWindowBlur);
    jQuery("#conversation_form").submit(jQuery.fn.chatsupport.onConversationFormSubmit);
    // If we scroll down to the bottom of #conversation_talk, we know that we see the newest messages
    jQuery("#conversation_talk").scroll(jQuery.fn.chatsupport.onConversationScroll);
    // Clicking on the "news message" information take us to the end of messages list
    jQuery("#conversation_status_new_messages").click(jQuery.fn.chatsupport.onNewMessageStatusClick);
    jQuery("#showDesktopNotificationsCheckbox").click(jQuery.fn.chatsupport.onShowDesktopNotificationsCheckboxClick);
    jQuery("#muteSoundNotificationsCheckbox").click(jQuery.fn.chatsupport.onMuteSoundNotificationsCheckboxClick);
  }

  jQuery.fn.chatsupport.changeConversationCheckingPeriod = function(period)
  {
    if (period == 0)
    {
      period = conversations_checking_period_normal;
    }
    if (conversation_timer) clearInterval(conversation_timer);
    conversation_timer = setInterval(jQuery.fn.chatsupport.refreshConversation, period); // setInterval
  }


  // Callback function have one parameter `data`, which is the messages array
  jQuery.fn.chatsupport.downloadMessagesList = function(last_message_id, id_interlocutor, update_last_downloaded_message_id, onListDownloadedCallback)
  {
    if (!last_message_id) last_message_id = global_last_message_id;
    if (last_message_id==0) jQuery("#conversation_talk").empty();

    jQuery.getJSON(settings.path.ajax.conversation,
    {
      "action" : "receive",
      "id_user_interlocutor" : id_interlocutor,
      "update_last_downloaded_message_id": update_last_downloaded_message_id,
      "id_last_message" : last_message_id,
      "token" : settings.token
    }, function (data)
    {
      if (onListDownloadedCallback)
        onListDownloadedCallback(data);
    }); // getJSON
  }

  jQuery.fn.chatsupport.refreshConversation = function()
  {
    if (checking_conversation) return;
    checking_conversation = true;
    // if user is on conversation page
    if (jQuery("#conversation_talk").length>0)
    {
      jQuery.fn.chatsupport.downloadMessagesList(0, jQuery("#conversation_message").attr("data-id_interlocutor"), true, function (data)
      {
        jQuery.fn.chatsupport.displayMessages(data);
      });
    } else
    {
      // if user is on another service page (not on the conversation page) // new messages notifications
      jQuery.fn.chatsupport.downloadMessagesList(-1, 0, false, function (data)
      {
        if ((data.messages)&&(data.messages.length>0))
        {
          jQuery.fn.chatsupport.displayNotification(data);
          jQuery.fn.chatsupport.playNotificationSound(data);
        }
      }); // downloadMessagesList
    }
    checking_conversation = false;
  }

  jQuery.fn.chatsupport.displayNotification = function(data)
  {
    // if user is on conversation page
    if (jQuery("#conversation_talk").length>0)
      if (!settings.show_desktop_notifications) return;

    if (Notification.permission == "granted")
    {
      // notifications are supported and allowed

      var last_message = "";
      if (data.messages.length>0)
        last_message = data.messages[data.messages.length-1].message_text;

      var options =
      {
        body: last_message.substr(0,60)+"...\r\nKliknij tutaj aby ją zobaczyć.",
        icon: settings.folder.design+"icon_message.png",
        tag: "new_message"
      };

      notificationObject = new Notification(settings.service_name+": Nowa wiadomość", options);
      if (data.messages.length>0)
        notificationObject.senderLogin = data.messages[data.messages.length-1].login_sender;
      notificationObject.addEventListener("click", function () { jQuery.fn.chatsupport.onNotificationClick(this.senderLogin); });

    } else
    {
      // HTML5 desktop notifications aren`t supported, we show a container
      jQuery("#conversation_status_new_messages").slideDown();

      if (data.state=="received")
      {
        jQuery("#notifications_container").empty();
        for (var i=0; i<data.messages.length; i++)
        {
          // If there is no notification about new message in notification list yet
          if (jQuery("#notifications_container div[data-user_id="+data.messages[i].id_user_sender+"]").length == 0)
          {
            if (console)
            console.log("Nowa wiadomość");
            // insert new notification
            jQuery("#notifications_container").append("<div data-user_id="+data.messages[i].id_user_sender+"><h3>Nowa wiadomość</h3><h4>Od: <a href=\"'.$path['profile'].'-"+data.messages[i].login_sender+"\" target=\"_blank\">"+data.messages[i].login_sender+"</a></h4><p><a href=\""+setting.path.conversation+"-"+data.messages[i].login_sender+"\" target=\"_blank\">Kliknij aby przejść do konwersacji w nowym oknie.</a></p></div>");
          }
        }
      }
    }
  }

  jQuery.fn.chatsupport.onNotificationClick = function(senderLogin)
  {
    if (senderLogin==null)
    {
      console.error("Sender login can`t be null.");
      return false;
    }

    if (senderLogin.length==0)
    {
      console.error("Sender login can`t be empty.");
      return false;
    }

    window.focus();

    // on conversation page
    if (jQuery("#conversation_talk").length>0)
    {
      jQuery.fn.chatsupport.scrollConversationToTheEnd();
    }else // on any other page (not conversation page)
    {
      jQuery("<div>Czy chcesz opuścić bieżącą stronę i przejść do rozmowy z graczem `"+senderLogin+"`?</div>").dialog(
      {
        closeText: "Zamknij",
        buttons:
        {
          "Przejdź do konwersacji" : function ()
          {
            location.href = settings.path.conversation+"-"+senderLogin;
          }
          ,
          "Anuluj" : function ()
          {
            jQuery(this).dialog("close");
          }
        }
      }
      );
    }

    return true;
  }

  jQuery.fn.chatsupport.playNotificationSound = function()
  {
    if (conversation_sound_notification.play)
      conversation_sound_notification.play();
  }

  jQuery.fn.chatsupport.scrollConversationToTheEnd = function()
  {
    if (jQuery("#conversation_talk").length==0) return;

    jQuery("#conversation_talk").animate(
    {
      scrollTop: jQuery("#conversation_talk").get(0).scrollHeight-jQuery("#conversation_talk").innerHeight()
    }, 500);
  }

  jQuery.fn.chatsupport.displayMessages = function(data)
  {
    // We must measure it before append some messages to message filed
    var scroll_or_not = parseInt(parseInt(jQuery("#conversation_talk").scrollTop())+parseInt(jQuery("#conversation_talk").innerHeight()))>=jQuery("#conversation_talk").get(0).scrollHeight;

    if (data.state == "received")
    {
      var are_there_new_messages_from_interlocutor = false;
      jQuery("#progress_downloaded_messages").attr("max",data.messages.length);

      for (var i=0; i<data.messages.length; i++)
      {
        jQuery("#progress_downloaded_messages").attr("value",i);

        // If between two messages the date changes, then add information about new date to conversation

        // Converting date time to format supported by all browsers
        var convertedDate = data.messages[i].date.replace(/-/g,"/");
        var parsedDate = new Date(convertedDate);
        var dayTable = ["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"];
        if (last_date!=parsedDate.getDate()+"-"+parsedDate.getMonth()+"-"+parsedDate.getFullYear())
        {
          jQuery("#conversation_talk").append("<h3>"+dayTable[parsedDate.getDay()]+", "+parsedDate.getDate()+"."+(parsedDate.getMonth()+1)+"."+parsedDate.getFullYear()+"</h3>");
        }
        last_date = parsedDate.getDate()+"-"+parsedDate.getMonth()+"-"+parsedDate.getFullYear();

        var tr = jQuery("<tr>");
        var nick = "";
        tr.addClass("message");
        if (data.messages[i].id_user_sender==settings.id_user)
        {
          tr.addClass("me");
          nick = "ja";
        }else
        {
          tr.addClass("interlocutor");
          nick = data.messages[i].login_sender;
        }

        var hour = (""+parsedDate.getHours()).length==1?"0"+parsedDate.getHours():parsedDate.getHours();
        var minute = (""+parsedDate.getMinutes()).length==1?"0"+parsedDate.getMinutes():parsedDate.getMinutes();

        tr.append('<td class="date">'+hour+':'+minute+'</td><td class="nick">'+nick+':</td><td>'+data.messages[i].message_text+'</td>');
        jQuery("#conversation_talk").append(tr);
        global_last_message_id = data.messages[i].id;
        are_there_new_messages_from_interlocutor |= data.messages[i].id_user_sender!=settings.id_user;
      }

      if (scroll_or_not)
      {
        jQuery.fn.chatsupport.scrollConversationToTheEnd()
      }

      // If there were new messages
      if ((are_there_new_messages_from_interlocutor)&&(data.messages_from_id_and_above>0))
      {
        jQuery.fn.chatsupport.displayNotification(data);
        jQuery.fn.chatsupport.playNotificationSound(data);
      }

    }
  }

  jQuery.fn.chatsupport.onWindowFocus = function()
  {
    jQuery.fn.chatsupport.changeConversationCheckingPeriod(conversations_checking_period_normal);
  }

  jQuery.fn.chatsupport.onWindowBlur = function()
  {
    jQuery.fn.chatsupport.changeConversationCheckingPeriod(conversations_checking_period_lazy);
  }

  jQuery.fn.chatsupport.onConversationScroll = function()
  {
    // Are we at the end of #conversation_talk container?
    if (parseInt(parseInt(jQuery("#conversation_talk").scrollTop())+parseInt(jQuery("#conversation_talk").innerHeight()))>=jQuery("#conversation_talk").get(0).scrollHeight-10)
    {
      jQuery("#conversation_status_new_messages").slideUp();
    }
  }

  jQuery.fn.chatsupport.onConversationFormSubmit = function()
  {
    // User can`t sent empty messages
    if (jQuery("#conversation_message").val()=="") return;

    jQuery("#conversation_status_sending").fadeIn();
    jQuery("#conversation_message").focus();

    jQuery.getJSON(settings.path.ajax.conversation,
      {
       "action" : "send",
       "id_user_recipient" : jQuery("#conversation_message").attr("data-id_interlocutor"),
       "message" : jQuery("#conversation_message").val(),
       "token" : settings.token
      },
      function (data){
        if (data.state == "sent")
        {
          jQuery("#conversation_message").val("");
          jQuery("#conversation_status_error").fadeOut();
          jQuery("#conversation_status_sending").fadeOut();
          // After message sent
        }
        if (data.state == "error")
        {
          jQuery("#conversation_status_sending").fadeOut();
          jQuery("#conversation_status_error").fadeIn().find("span").html(data.message);
          // After message sent
        }
    }); // getJSON()
    return false;
  }

  // Clicking on the "news message" information take us to the end of messages list
  jQuery.fn.chatsupport.onNewMessageStatusClick = function()
  {
    jQuery.fn.chatsupport.scrollConversationToTheEnd();
    jQuery(this).slideUp();
  }

  jQuery.fn.chatsupport.onShowDesktopNotificationsCheckboxClick = function()
  {
    // are desktop Notifications supported?
    if (!window.Notification)
    {
      alert("Twoja przeglądarka nie obsługuje powiadomień pojawiających się na pulpicie. Zaktualizuj ją aby korzystać z tej opcji.");
      jQuery(this).removeAttr("checked");
      return;
    }

    jQuery.getJSON(settings.path.ajax.conversation,
      {
        "action" : "show_desktop_notifications",
        "value" : jQuery("#showDesktopNotificationsCheckbox").is(":checked")?1:0,
        "token" : settings.token
      },
      function (data){
        if (data.state == "set")
        {
          if (data.value == 1)
          {
            jQuery("#showDesktopNotificationsCheckbox").attr("checked","checked");
            settings.show_desktop_notifications = true;
            if (window.Notification)
            {
              window.Notification.requestPermission(function (status){

              });
            }
          }else{
            jQuery("#showDesktopNotificationsCheckbox").removeAttr("checked");
            settings.show_desktop_notifications = false;
            notificationObject = null;
          }
        }
      }
    );

  }

  jQuery.fn.chatsupport.onMuteSoundNotificationsCheckboxClick = function()
  {
    jQuery.getJSON(settings.path.ajax.conversation,
      {
        "action" : "play_new_message_sound",
        "value" : jQuery("#muteSoundNotificationsCheckbox").is(":checked")?0:1,
        "token" : settings.token
      },
      function (data){
        if (data.state == "set")
        {
          if (data.value == 1)
          {
            jQuery("#muteSoundNotificationsCheckbox").removeAttr("checked");
            conversation_sound_notification.muted = false;
          }else{
            jQuery("#muteSoundNotificationsCheckbox").attr("checked","checked");
            conversation_sound_notification.muted = true;
          }
          settings.play_new_message_sound != conversation_sound_notification.muted;
        }
      }
    );
  }


  jQuery.fn.chatsupport.createAudioPlayer = function ()
  {
    conversation_sound_notification = document.createElement("audio");
    conversation_sound_notification.muted = settings.show_desktop_notifications;
    var source = document.createElement("source");
    if (conversation_sound_notification.canPlayType)
    {
      if (conversation_sound_notification.canPlayType("audio/mpeg;"))
      {
        source.type = "audio/mpeg";
        source.src = settings.folder.design+"notification.mp3";
      } else
      {
        source.type = "audio/ogg";
        source.src = settings.folder.design+"notification.ogg";
      }
      conversation_sound_notification.appendChild(source);
    }
    conversation_sound_notification.muted = !settings.play_new_message_sound;
  }

})(jQuery);