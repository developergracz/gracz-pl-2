package sfs2x.extensions.games.gracz;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import com.smartfoxserver.bitswarm.sessions.ISession;
import com.smartfoxserver.v2.core.SFSConstants;
import com.smartfoxserver.v2.core.SFSEventParam;
import com.smartfoxserver.v2.db.IDBManager;
import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSArray;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.exceptions.SFSErrorCode;
import com.smartfoxserver.v2.exceptions.SFSErrorData;
import com.smartfoxserver.v2.exceptions.SFSException;
import com.smartfoxserver.v2.exceptions.SFSExtensionException;
import com.smartfoxserver.v2.exceptions.SFSLoginException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class GetFriendsListHandler extends BaseClientRequestHandler{
	
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		GraczZoneExtension gameExt = (GraczZoneExtension) getParentExtension();
		
		Object php_user_id_obj = user.getSession().getProperty("php_user_id");
		int php_user_id = -1;
		if (php_user_id_obj!=null)
		{
			php_user_id = (Integer) php_user_id_obj;
		}else{
			trace("Warning: No `php_user_id` property found in User session properties.");
		}
		
		ISFSObject sfsObject;
		try {
			sfsObject = getAvailableAndUnavailableFriendsListsWithScores(php_user_id);
			// Sending friends List
			trace("Sending available and unavailable friends list with scores to client.");
			send("getFriendsList", sfsObject, user);
		} catch (SFSExtensionException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (SFSLoginException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}		
	}

	public ISFSObject getAvailableAndUnavailableFriendsListsWithScores(int php_user_id) throws SFSExtensionException, SFSLoginException
	{		
		trace("Getting available and unavailable friends lists for php_user_id="+php_user_id+"...");
		if (php_user_id <= 0)
		{
	        // Create the error code to send to the client  
	        SFSErrorData errData = new SFSErrorData(SFSErrorCode.LOGIN_BAD_USERNAME);
	         
	        // Fire a Login exception
	        throw new SFSLoginException("Warning: Can\'t get available and unavailable friends list because user is not logged in.", errData);
		}
		
		IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
		Connection connection = null;

		ISFSObject sfsObject = new SFSObject();
		
		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			 
			// Build a prepared statement
			PreparedStatement stmt = connection.prepareStatement(
					  "   SELECT id, ranking_pos, sex, login, scores_sum, last_seen, logged_in "
					+ "     FROM ( "
					+ "				SELECT @i:=@i+1 AS ranking_pos, prefix_ranking_without_places.* "
					+ "               FROM prefix_ranking_without_places "
					+ "               JOIN (SELECT @i:=0) AS temp2 /* Its workaround to not execute two queries (one for initialise @i variable and second for true query) */"
					+ "          ) AS prefix_ranking_with_places "
					+ "RIGHT JOIN prefix_friends "
					+ "       ON prefix_ranking_with_places.id = prefix_friends.id_friend "
					+ "      AND prefix_friends.id_user = ?"
					+ "    WHERE logged_in = ? "
					+ "      AND id <> ?");
			stmt.setInt(1, php_user_id);
			stmt.setInt(3, php_user_id);

			// GETTING AVAILABLE USERS
			stmt.setBoolean(2, true); // getting available friends
			SFSArray sfsArray = new SFSArray();

			// Execute query
			ResultSet res = stmt.executeQuery();
			while (res.next())
			{
				SFSObject sfsObjectUser = new SFSObject();
				sfsObjectUser.putInt("userId", res.getInt("id"));
				sfsObjectUser.putInt("userPlace", res.getInt("ranking_pos"));
				sfsObjectUser.putUtfString("userSex", res.getInt("sex")==1?"female":"male");
				sfsObjectUser.putInt("userPoints", res.getInt("scores_sum"));
				sfsObjectUser.putUtfString("userName", res.getString("login"));
				sfsObjectUser.putBool("loggedIn", res.getBoolean("logged_in"));
				sfsArray.addSFSObject(sfsObjectUser);
			}
			trace("Got "+sfsArray.size()+" rows of available friends.");
			sfsObject.putSFSArray("availableFriendsList", sfsArray);

			// GETTING UNAVAILABLE USERS
			stmt.setBoolean(2, false); // getting unavailable friends

			SFSArray sfsArray2 = new SFSArray();

			// Execute query
			res = stmt.executeQuery();
			trace("Got "+res.getFetchSize()+" rows of unavailable friends.");
			while (res.next())
			{

				SFSObject sfsObjectUser = new SFSObject();
				sfsObjectUser.putInt("userId", res.getInt("id"));
				sfsObjectUser.putInt("userPlace", res.getInt("ranking_pos"));
				sfsObjectUser.putUtfString("userSex", res.getInt("sex")==2?"female":"male");
				sfsObjectUser.putInt("userPoints", res.getInt("scores_sum"));
				sfsObjectUser.putUtfString("userName", res.getString("login"));
				sfsObjectUser.putBool("loggedIn", res.getBoolean("logged_in"));
				sfsArray2.addSFSObject(sfsObjectUser);
			}
			trace("Got "+sfsArray2.size()+" rows of unavailable friends.");
			sfsObject.putSFSArray("unavailableFriendsList", sfsArray2);
			
		}catch(SQLException sqle)
		{
		    trace("Database SQL statement error."+sqle.toString());
		    // we must throw something to stop logging process
		    throw new SFSExtensionException("Database SQL statement error."+sqle.toString());
		}finally
		{
		    try
		    {
		    	connection.close();
		    	trace("Database connection closed (OK).");
		    }
		    catch(SQLException sqle)
		    {
		        trace("Database connection (from extension) can not be NULL (but it is!).");
		    }
		    return sfsObject;
		}
	}
	
}
