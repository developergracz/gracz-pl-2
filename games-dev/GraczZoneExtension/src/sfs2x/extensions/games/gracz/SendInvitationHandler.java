package sfs2x.extensions.games.gracz;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import com.smartfoxserver.bitswarm.sessions.ISession;
import com.smartfoxserver.v2.core.ISFSEvent;
import com.smartfoxserver.v2.core.SFSConstants;
import com.smartfoxserver.v2.core.SFSEventParam;
import com.smartfoxserver.v2.db.IDBManager;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.exceptions.SFSErrorCode;
import com.smartfoxserver.v2.exceptions.SFSErrorData;
import com.smartfoxserver.v2.exceptions.SFSException;
import com.smartfoxserver.v2.exceptions.SFSLoginException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;
import com.smartfoxserver.v2.extensions.BaseServerEventHandler;

public class SendInvitationHandler extends BaseClientRequestHandler
{
	@Override
	public void handleClientRequest(User user, ISFSObject params)
	{
		GraczZoneExtension gameExt = (GraczZoneExtension) getParentExtension();
		
		String usernameOrEmail = params.getUtfString("usernameOrEmail");
		String roomName = params.getUtfString("roomName");
		String zoneName = gameExt.getParentZone().getName();
		
		Object php_user_id_obj = user.getSession().getProperty("php_user_id");
		int php_user_id = -1;
		if (php_user_id_obj!=null)
		{
			php_user_id = (Integer) php_user_id_obj;
		}else{
			trace("Warning: No `php_user_id` property found in User session properties.");
			return;
		}
		
		trace("User PHP_USER_ID="+php_user_id+" is sending invitation to player `"+usernameOrEmail+"` to join the room `"+roomName+"`.");
		IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
		Connection connection = null;

		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			 
			// Build a prepared statement
			PreparedStatement stmt = connection.prepareStatement("INSERT INTO prefix_invitations SET id_sender = ?, id_invited_user = (SELECT id FROM prefix_users WHERE login = ? OR email = ?), room_name = ?, zone_name = ?");
			stmt.setInt(1, php_user_id);
			stmt.setString(2, usernameOrEmail);
			stmt.setString(3, usernameOrEmail);
			stmt.setString(4, roomName);
			stmt.setString(5, zoneName);
			
			// Execute query
			stmt.executeUpdate();
			
		}catch(SQLException sqle)
		{
		    trace("Database SQL statement error: "+sqle.toString());
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
		}
		
   }

}