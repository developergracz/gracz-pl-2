package sfs2x.extensions.games.gracz;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import com.smartfoxserver.v2.api.CreateRoomSettings;
import com.smartfoxserver.v2.api.CreateRoomSettings.RoomExtensionSettings;
import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.variables.RoomVariable;
import com.smartfoxserver.v2.entities.variables.SFSRoomVariable;
import com.smartfoxserver.v2.exceptions.SFSCreateRoomException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;

public class CreateRoomHandler extends BaseClientRequestHandler{

	@Override
	public void handleClientRequest(User user, ISFSObject params) {
		GraczZoneExtension gameExt = (GraczZoneExtension) getParentExtension();
		
		// Getting default room setting (we copy these settings to newly created room)
		Room defaultRoom = gameExt.getParentZone().getRoomByName("default");
		// Create a new Room with the given (as parameter) name
		CreateRoomSettings settings = new CreateRoomSettings();
		settings.setName(params.getUtfString("roomName"));
		settings.setMaxUsers(defaultRoom.getMaxUsers());
		settings.setMaxSpectators(defaultRoom.getMaxSpectators());
		settings.setGame(defaultRoom.isGame());
		Map<Object, Object> map = new HashMap<Object,Object>();
		if (params.getBool("gameNotInRank")!=null)
			map.put("gameNotInRank", params.getBool("gameNotInRank"));
		if (params.getInt("gameDuration")!=null)
			map.put("gameDuration", params.getInt("gameDuration"));
		if (params.getUtfString("roomVisibility")!=null)
			map.put("roomVisibility", params.getUtfString("roomVisibility"));
		settings.setRoomProperties(map);
		String roomGroup = defaultRoom.getGroupId();
		if (roomGroup == null) roomGroup = "";
		if (roomGroup.equals("null")) roomGroup = "";
		settings.setGroupId(roomGroup);
		
		/*
		* RoomVariables also support different flags:
		* Private: a private variable can only be modified by its creator
		* Persistent: a persistent variable will continue to exist even if its creator has left the room. Server-created Room Variables will never be removed.
		* Global: a global variable will fire updates not only to all Users in the Room but also to all Users in the Room Group
		* Hidden: an hidden variable will be kept on the server side only.
		*/
		// So... roomCreatorUserSmartfoxId and roomCreatorUserDatabaseId MUST BE private so other user can't change it and set himself as room creator!
		ArrayList<RoomVariable> listOfRoomVariables = new ArrayList<RoomVariable>();
		listOfRoomVariables.add(new SFSRoomVariable("roomCreatorUserSmartfoxId",user.getId(),true,true,false));
		listOfRoomVariables.add(new SFSRoomVariable("roomCreatorUserDatabaseId",user.getSession().getProperty("php_user_id"),true,true,false));
		settings.setRoomVariables(listOfRoomVariables);
		trace("Ustawione zmienne pokoju. "+settings.getRoomVariables().toString());
		
		RoomExtensionSettings extensionSettings = new RoomExtensionSettings(
														defaultRoom.getExtension().getName(), 
														defaultRoom.getExtension().getClass().getCanonicalName()
													  );
		extensionSettings.setPropertiesFile(defaultRoom.getExtension().getPropertiesFileName());
		settings.setExtension(extensionSettings);

		try {
			getApi().createRoom(gameExt.getParentZone(), settings, user);
			trace("Added new room called `"+params.getUtfString("roomName")+"` to the zone `"+gameExt.getName()+"`.");
		} catch (SFSCreateRoomException e) {
			trace("Error: Zone: `"+gameExt.getName()+"`, Room `"+params.getUtfString("roomName")+"` creation error: "+e.getMessage());
			e.printStackTrace();
		}
	}

}
