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
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.exceptions.SFSErrorCode;
import com.smartfoxserver.v2.exceptions.SFSErrorData;
import com.smartfoxserver.v2.exceptions.SFSException;
import com.smartfoxserver.v2.exceptions.SFSLoginException;
import com.smartfoxserver.v2.extensions.BaseServerEventHandler;

public class OnLoginEventHandler extends BaseServerEventHandler
{
	@Override
	public void handleServerEvent(ISFSEvent event) throws SFSException 
	{
		// Login is really php_session_id identifier
		String phpSessionId = (String) event.getParameter(SFSEventParam.LOGIN_NAME);
		ISession smartfoxSession = (ISession) event.getParameter(SFSEventParam.SESSION);
		ISFSObject outData = (ISFSObject) event.getParameter(SFSEventParam.LOGIN_OUT_DATA);
		
		trace("Logging using PHPSESSID="+phpSessionId+" (retreiving user information), SMARTFOX_SESSION_ID="+smartfoxSession.getId());
		IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
		Connection connection = null;

		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			 
			// Build a prepared statement
			PreparedStatement stmt = connection.prepareStatement("SELECT temp2.* "
					+ " FROM ("
					+ "   SELECT @i:=@i+1 AS place, temp.* "
					+ "   FROM ("
					+ "     SELECT prefix_users.id, prefix_users.login, prefix_users.session_id, prefix_users.sex, won, lost, plays_count, scores_sum, prefix_users.date_register "
					+ "     FROM prefix_users "
					+ "     LEFT JOIN prefix_ranking_without_places "
					+ "     ON prefix_ranking_without_places.id = prefix_users.id "
					+ "     JOIN (SELECT @i:=0) AS temp_workaround " // It's workaround to not execute two queries (one for initialise @i variable and second for true query)
					+ "     ORDER BY scores_sum DESC"
					+ "   ) AS temp"
					+ "   ORDER BY place"
					+ " ) AS temp2 "
					+ " WHERE temp2.session_id = ? "
					+ "   AND temp2.session_id IS NOT NULL "
					+ "   AND temp2.session_id <> '' "
					+ " LIMIT 1");
			stmt.setString(1, phpSessionId);

			// Execute query
			ResultSet res = stmt.executeQuery();
			if (res.next())
			{
				outData.putUtfString(SFSConstants.NEW_LOGIN_NAME, res.getString("login"));
				outData.putUtfString("sex", res.getString("sex"));
				
				smartfoxSession.setProperty("php_user_id", res.getInt("id"));
				smartfoxSession.setProperty("sex", res.getInt("sex"));

				int place = res.getInt("place");
				if (res.wasNull()) place = -1; // this should never happen
				smartfoxSession.setProperty("place", place);
								
				int won = res.getInt("won");
				if (res.wasNull()) won = 0;
				smartfoxSession.setProperty("won", won);

				int lost = res.getInt("lost");
				if (res.wasNull()) lost = 0;
				smartfoxSession.setProperty("lost", lost);

				int scores_sum = res.getInt("scores_sum");
				if (res.wasNull()) scores_sum = 0;
				smartfoxSession.setProperty("scores_sum", scores_sum);

				int plays_count = res.getInt("plays_count");
				if (res.wasNull()) plays_count = 0;
				smartfoxSession.setProperty("plays_count", plays_count);
				
				smartfoxSession.setProperty("date_register", res.getDate("date_register"));
				trace("User '"+res.getString("login")+"' found and logged in. A data record has been retreived.");
			}else
			{
		        // Create the error code to send to the client  
		        SFSErrorData errData = new SFSErrorData(SFSErrorCode.LOGIN_BAD_USERNAME);
		         
		        // Fire a Login exception
		        throw new SFSLoginException("You are not logged in! Please login and try again :)", errData);
			}
			
		}catch(SQLException sqle)
		{
		    trace("Database SQL statement error."+sqle.toString());
		    // we must throw something to stop logging process
		    throw new SFSLoginException("Database SQL statement error."+sqle.toString());
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