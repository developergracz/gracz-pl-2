package sfs2x.extensions.games.gracz;

import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class GetOptionsHandler extends BaseClientRequestHandler{
	
	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		GraczZoneExtension gameExt = (GraczZoneExtension) getParentExtension();
		String roomName = params.getUtfString("roomName").toString();
		
		Room room = gameExt.getParentZone().getRoomByName(roomName);
		boolean amIRoomCreator = false;
		if (room!=null)
		{
			Object php_user_id_obj = user.getSession().getProperty("php_user_id");
			int php_user_id = -1;
			if (php_user_id_obj!=null)
			{
				php_user_id = (Integer) php_user_id_obj;
			}else{
				trace("Warning: No `php_user_id` property found in User session properties.");
			}
			
			if (room.getVariable("roomCreatorUserDatabaseId")!=null)
				amIRoomCreator = room.getVariable("roomCreatorUserDatabaseId").getIntValue() == php_user_id;
			else
				amIRoomCreator = false;
		}
		ISFSObject sfsObject = new SFSObject();
		sfsObject.putBool("amIRoomCreator", amIRoomCreator);
		sfsObject.putBool("gameNotInRank", (Boolean) room.getProperty("gameNotInRank"));
		sfsObject.putUtfString("roomVisibility", room.isHidden()?"PRIVATE":"PUBLIC");
		sfsObject.putInt("gameDuration", (Integer) room.getProperty("gameDuration"));

		// Sending the id of the room creator
		send("getOptions",sfsObject,user);
		
		trace("Sending room options to client: notInRank("+room.getProperty("gameNotInRank")+"), isHidden("+(room.isHidden()?"PRIVATE":"PUBLIC")+"), gameDuration("+room.getProperty("gameDuration")+")");
	}

}
