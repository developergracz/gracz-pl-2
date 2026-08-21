package sfs2x.extensions.games.gomoku;

import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

// Added 16.03.2015 by £ukasz Wyporek
public class SetRoomVisibilityHandler extends BaseClientRequestHandler {
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		Room room = this.getParentExtension().getParentRoom();
		IGeneralRoomOptions gameExt = (IGeneralRoomOptions) room.getExtension();

		// Converting room visibility from String to enum
		String roomVisibility = (String) params.getUtfString("roomVisibility");
		
		ISFSObject sfsObject = new SFSObject();

		if (gameExt.setRoomVisibility(user, roomVisibility))
		{
			sfsObject.putUtfString("roomVisibility", gameExt.getRoomVisibility());
			// sending notification to all users in this room
			java.util.List<User> usersList = room.getUserList();
			usersList.remove(user); // remove user which demand variable change
			send("setRoomVisibility", sfsObject, usersList);
			trace("Setting room visibility to: "+roomVisibility);
		}else{
			sfsObject.putUtfString("roomVisibility", gameExt.getRoomVisibility());
			send("setRoomVisibility", sfsObject, user);
			trace("User isn't creator of this room, so he can't change `room visivility` option. Sending back actual setting.");
		}

	
	}

}
