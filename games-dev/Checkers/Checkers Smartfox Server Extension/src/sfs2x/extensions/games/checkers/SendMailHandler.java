package sfs2x.extensions.games.checkers;

import javax.mail.MessagingException;

import com.smartfoxserver.v2.SmartFoxServer;
import com.smartfoxserver.v2.entities.Email;
import com.smartfoxserver.v2.entities.SFSEmail;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class SendMailHandler extends BaseClientRequestHandler {
	private String fromEmail = "administracja@gracz.pl";

	public void setServiceEmail(String newServiceEmail)
	{
		this.fromEmail = newServiceEmail;
	}
		
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		// TODO Auto-generated method stub
		
		CheckersExtension gameExt = (CheckersExtension) getParentExtension();		
		
		// Zmieni³em wartoœæ zmiennej from z "marcin.sroda89@gmail.com" na t¹ zdefiniowan¹ jako pole klasy ~£ukasz Wyporek, 09.06.2014
		String to = params.getUtfString("to");
		String subject = params.getUtfString("subject");
		String mail = params.getUtfString("mail");
		
		
		Email myEmail = new SFSEmail(this.fromEmail, to, subject, mail);
		try {
			SmartFoxServer.getInstance().getMailService().sendMail(myEmail);
			gameExt.trace("Mail sent successfully to "+to);
		} catch (MessagingException e) {
			// TODO Auto-generated catch block
			gameExt.trace("Mail failed to be sent to "+to);
			e.printStackTrace();
		}
		
		
		//Boolean su = gameExt.sendMail(from,to,subject,mail);
		
		
	    /*if(su){
	    	gameExt.trace("Mail sent successfully to "+to);
	    }else{
	    	gameExt.trace("Mail failed to be sent to "+to);
	    }*/
	      
	}

}
