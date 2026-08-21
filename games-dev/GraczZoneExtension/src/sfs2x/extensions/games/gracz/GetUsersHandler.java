package sfs2x.extensions.games.gracz;

import java.io.UnsupportedEncodingException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Date;
import java.util.ArrayList;
import java.util.Formatter;

import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSArray;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSArray;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class GetUsersHandler extends BaseClientRequestHandler{
	
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		GraczZoneExtension gameExt = (GraczZoneExtension) getParentExtension();
		// Get the java list of socket channels
		ArrayList<User> usersList = (ArrayList<User>) gameExt.getParentZone().getUserList();
		
		// We must trim some data from data returned by getUserList() and send that trimmed data to the user;
		ISFSArray returnedUsersList = new SFSArray();
		String connectedLogins = ""; // used for hash calculation
		for (User userObject : usersList)
		{
			ISFSObject sfsObject = new SFSObject();
			sfsObject.putUtfString("login", userObject.getName());
			sfsObject.putInt("smartfoxUserId", userObject.getId());
			sfsObject.putInt("databaseUserId", (Integer) userObject.getSession().getProperty("php_user_id"));
			sfsObject.putInt("sex", (Integer) userObject.getSession().getProperty("sex"));
			sfsObject.putInt("won", (Integer) userObject.getSession().getProperty("won"));
			sfsObject.putInt("lost", (Integer) userObject.getSession().getProperty("lost"));
			sfsObject.putInt("scores_sum", (Integer) userObject.getSession().getProperty("scores_sum"));
			sfsObject.putInt("place", (Integer) userObject.getSession().getProperty("place"));
			sfsObject.putInt("plays_count", (Integer) userObject.getSession().getProperty("plays_count"));
			sfsObject.putUtfString("date_register", (String) ((Date) userObject.getSession().getProperty("date_register")).toString() );
			connectedLogins += userObject.getName();
			
			returnedUsersList.addSFSObject(sfsObject);
		}
		// Maybe we musn't send updated list to the user (maybe it's actual) - we compare hashes of logins to check it
		if (encryptSHA1(connectedLogins).equals(params.getUtfString("hash")))
		{
			//trace("Listy u¿ytkowników s¹ takie same.");
			return;
		}

		ISFSObject obj = new SFSObject();
		obj.putSFSArray("usersList",returnedUsersList);
		// Sending the list of users
		trace("Sending users list specially for user ("+user.getName().toString()+"):"+returnedUsersList.toString());
		send("usersList",obj,user);
	}

	
	private static String encryptSHA1(String password)
	{
	    String sha1 = "";
	    try
	    {
	        MessageDigest crypt = MessageDigest.getInstance("SHA-1");
	        crypt.reset();
	        crypt.update(password.getBytes("UTF-8"));
	        sha1 = byteToHex(crypt.digest());
	    }
	    catch(NoSuchAlgorithmException e)
	    {
	        e.printStackTrace();
	    }
	    catch(UnsupportedEncodingException e)
	    {
	        e.printStackTrace();
	    }
	    return sha1;
	}

	private static String byteToHex(final byte[] hash)
	{
	    Formatter formatter = new Formatter();
	    for (byte b : hash)
	    {
	        formatter.format("%02x", b);
	    }
	    String result = formatter.toString();
	    formatter.close();
	    return result;
	}	
}
