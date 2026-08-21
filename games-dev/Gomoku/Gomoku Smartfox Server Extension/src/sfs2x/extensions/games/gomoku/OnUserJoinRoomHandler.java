package sfs2x.extensions.games.gomoku;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;

import com.smartfoxserver.v2.core.ISFSEvent;
import com.smartfoxserver.v2.core.SFSEventParam;
import com.smartfoxserver.v2.db.IDBManager;
import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.variables.SFSUserVariable;
import com.smartfoxserver.v2.entities.variables.UserVariable;
import com.smartfoxserver.v2.exceptions.SFSException;
import com.smartfoxserver.v2.exceptions.SFSVariableException;
import com.smartfoxserver.v2.extensions.BaseServerEventHandler;

public class OnUserJoinRoomHandler extends BaseServerEventHandler{
	
	public void handleServerEvent(ISFSEvent event) throws SFSException
	{
		GomokuExtension gameExt = (GomokuExtension) getParentExtension();
		//Room gameRoom = gameExt.getGameRoom();
		
		// Get event params
		User user = (User) event.getParameter(SFSEventParam.USER);
		Room room = (Room) event.getParameter(SFSEventParam.ROOM);
		trace("HEJ:"+room);
		trace("HEJ2:"+room.getProperty("gameDuration"));
		// Code below added by £ukasz Wyporek, 13.06.2014
		// Adding php_user_id property to User properties (php_user_id is identifier which the specified user has in MySQL database)
		loadUserVariablesFromDatabase(user);
		// End of 13.06.2014 modification
				
		gameExt.updateSpectator(user);
	}
	
	// Added by £ukasz Wyporek, 13.06.2014
	// 
	public void loadUserVariablesFromDatabase(User user)
	{
		GomokuExtension gameExt = (GomokuExtension) getParentExtension(); // added 14.10.2014 by £ukasz Wyporek

		IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
		Connection connection = null;
		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			 
			// Build a prepared statement
			PreparedStatement stmt = connection.prepareStatement("SELECT id, login, sex, status, COUNT(prefix_scores.score) AS plays_count, SUM(prefix_scores.score) AS score"
					+ " FROM prefix_users "
					+ " LEFT JOIN prefix_scores"
					+ " ON prefix_scores.id_user = prefix_users.id"
					+ " WHERE id = ?"
					+ " AND id_gameplay = ?"); // change 15.10.2014, £ukasz Wyporek
			stmt.setLong(1, (Integer) user.getSession().getProperty("php_user_id"));
			stmt.setLong(2, gameExt.getGameplayId());

			// Execute query
			ResultSet res = stmt.executeQuery();
			if (res.next())
			{
				ArrayList<UserVariable> uvList = new ArrayList<UserVariable>();
				uvList.add(new SFSUserVariable("sex", res.getInt("sex")));
				//uvList.add(new SFSUserVariable("status", res.getString("status")));
				uvList.add(new SFSUserVariable("plays_count", res.getInt("plays_count")));
				uvList.add(new SFSUserVariable("score", res.getInt("score")));
				//user.setVariable(uv);
				user.setVariables(uvList);
				this.getApi().getResponseAPI().notifyUserVariablesUpdate(user, uvList);
				
				trace("Retreiving user data: User data was updated from database (for example plays_count="+res.getInt("plays_count")+").");
			}else
			{
		        trace("Retreiving user data error: Can't find user with given PHP_ID in database.");
			}
			
		}catch(SQLException sqle)
		{
		    trace("Database SQL statement error."+sqle.toString());
		} catch (SFSVariableException e) {
			trace("SFSVariable Exception occured.");
			e.printStackTrace();
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
