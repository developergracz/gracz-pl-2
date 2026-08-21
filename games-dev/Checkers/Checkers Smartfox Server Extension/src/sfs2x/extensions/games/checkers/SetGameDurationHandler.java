package sfs2x.extensions.games.checkers;

import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

// Added 16.03.2015 by £ukasz Wyporek
public class SetGameDurationHandler extends BaseClientRequestHandler {
	
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		Room room = this.getParentExtension().getParentRoom();
		IGeneralRoomOptions gameExt = (IGeneralRoomOptions) room.getExtension();
		
		Integer gameDuration = params.getInt("gameDuration");
		
		if (gameDuration<60||gameDuration>30*60)
			gameDuration = 60;
		
		ISFSObject sfsObject = new SFSObject();
		sfsObject.putInt("gameDuration", gameDuration);

		if (gameExt.isUserRoomCreator(user))
		{
			// Only if game has not started yet
			if (gameExt.setGameDuration(user, gameDuration))
			{
				// sending notification to all users in this room
				java.util.List<User> usersList = room.getUserList();
				usersList.remove(user); // remove user which demand variable change
				send("setGameDuration", sfsObject, usersList);
				trace("Setting game duration to: "+gameDuration);
			}else{
				trace("Can't change game duration because game already started.");				
			}
		}else{
			trace("User isn't creator of this room, so he can't change `game duration` option. Sending back actual setting.");			
			send("setGameDuration", sfsObject, user);
		}
	}

}
