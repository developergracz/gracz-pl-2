package sfs2x.extensions.games.checkers;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import sfs2x.extensions.games.checkers.SetCanUndoHandler;
import sfs2x.extensions.games.checkers.SetGameAsNotInRankHandler;
import sfs2x.extensions.games.checkers.SetGameDurationHandler;
import sfs2x.extensions.games.checkers.SetRoomVisibilityHandler;

import com.smartfoxserver.v2.SmartFoxServer;
//import com.smartfoxserver.v2.buddylist.SFSBuddyEventParam;
import com.smartfoxserver.v2.core.SFSEventType;
import com.smartfoxserver.v2.db.IDBManager;
import com.smartfoxserver.v2.entities.Room;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.extensions.SFSExtension;

public class CheckersExtension extends SFSExtension implements IGeneralRoomOptions {
	private GameBoard gameBoard;
	private User whoseTurn;
	private volatile boolean gameStarted;
	private LastGameEndResponse lastGameEndResponse;
	private int moveCount;
	private boolean sitted1, sitted2 = false;
	private int sitted1Id = 0, sitted2Id = 0;
	private boolean ready1 = false, ready2 = false;
	private final int defaultGlobalTime = 180;
	private int time1 = 30, time2 = 30;
	private boolean canTie1 = true, canTie2 = true;
	private boolean paused = false;
	private long database_id_gameplay = 0; //  Added by £ukasz Wyporek, 15.10.2014

	
	private final String version = "0.9.9";

	private class TaskRunner implements Runnable {
		public void run() {
			timer();
		}
	}

	// Keeps a reference to the task execution
	ScheduledFuture<?> taskHandle;

	@Override
	public void init() {
		SmartFoxServer sfs = SmartFoxServer.getInstance();
		// Schedule the task to run every second, with no initial delay
		taskHandle = sfs.getTaskScheduler().scheduleAtFixedRate(
				new TaskRunner(), 0, 1, TimeUnit.SECONDS);
		trace("Gomoku game Extension for SFS2X started, rel. " + version);

		moveCount = 0;
		gameBoard = new GameBoard(this);
		
		// Setting global time to all players
		// added by £ukasz Wyporek, 12.03.2015		
		this.setNoRankingOption();
		this.setRoomVisibility();
		this.setGameDuration();

		addRequestHandler("move", MoveHandler.class);
		addRequestHandler("restart", RestartHandler.class);
		addRequestHandler("ready", ReadyHandler.class);
		addRequestHandler("sit", SitHandler.class);
		addRequestHandler("sendMail", SendMailHandler.class);
		addRequestHandler("tie", TieHandler.class);
		addRequestHandler("answerTie", AnswerTieHandler.class);
		addRequestHandler("undo", UndoHandler.class);
		addRequestHandler("answerUndo", AnswerUndoHandler.class);
		addRequestHandler("block", BlockHandler.class);
		addRequestHandler("setCanUndo", SetCanUndoHandler.class);  // Added 14.03.2015 by £ukasz Wyporek
		addRequestHandler("setGameAsNotInRank", SetGameAsNotInRankHandler.class);  // Added 16.03.2015 by £ukasz Wyporek
		addRequestHandler("setRoomVisibility", SetRoomVisibilityHandler.class);  // Added 17.03.2015 by £ukasz Wyporek
		addRequestHandler("setGameDuration", SetGameDurationHandler.class);  // Added 14.03.2015 by £ukasz Wyporek

		// send ids, names...
		addEventHandler(SFSEventType.USER_JOIN_ROOM, OnUserJoinRoomHandler.class);
		addEventHandler(SFSEventType.USER_DISCONNECT, OnUserGoneHandler.class);
		addEventHandler(SFSEventType.USER_LEAVE_ROOM, OnUserGoneHandler.class);
		addEventHandler(SFSEventType.SPECTATOR_TO_PLAYER,
				OnSpectatorToPlayerHandler.class);
		addEventHandler(SFSEventType.PLAYER_TO_SPECTATOR,
				OnPlayerToSpectatorHandler.class);

	}

	@Override
	public void destroy() {
		super.destroy();
		trace("Checkers game destroyed!");
	}

	// Added 16.03.2015 by £ukasz Wyporek
	public boolean isUserRoomCreator(User user)
	{
		Room room = this.getParentRoom();
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
			
			return room.getVariable("roomCreatorUserDatabaseId").getIntValue() == php_user_id;
		}
		return false;
	}
	
	// Added 17.03.2015 by £ukasz Wyporek
	public boolean setGameDuration(User user, int gameDuration)
	{
		if (!this.isUserRoomCreator(user)) return false;
		return this.setGameDuration(gameDuration);
	}

	// Added 24.03.2015 by £ukasz Wyporek
	private boolean setGameDuration()
	{
		if (this.getParentRoom().getProperty("gameDuration")==null)
			return this.setGameDuration(this.defaultGlobalTime);
		else
			return this.setGameDuration((Integer)this.getParentRoom().getProperty("gameDuration"));
	}
	
	private boolean setGameDuration(Integer gameDuration)
	{
		if (this.isGameStarted()) return false;
		this.getParentRoom().setProperty("gameDuration", gameDuration);
		time1 = time2 = gameDuration;
		return true;
	}

	// Added 19.03.2015 by £ukasz Wyporek
	public int getGameDuration()
	{
		Integer gameDuration = (Integer) this.getParentRoom().getProperty("gameDuration");
		if (gameDuration==null)
			return this.defaultGlobalTime;
		else
			return gameDuration;
	}
	
	// Added by £ukasz Wyporek 16.03.2015
	@Override
	public boolean setNoRankingOption(User user, boolean noRanking) {
		// If user is room creator and the game has not started yet (if it is started it will be not fair to change rules)
		if (!this.isUserRoomCreator(user)) return false;
		return this.setNoRankingOption(noRanking);
	}

	// Added by £ukasz Wyporek 24.03.2015
	private boolean setNoRankingOption() {
		trace("DEBUG1:"+this.getParentRoom().getProperty("gameNotInRank"));
		if (this.getParentRoom().getProperty("gameNotInRank")==null)
			return this.setNoRankingOption(false);
		else
			return this.setNoRankingOption((Boolean)this.getParentRoom().getProperty("gameNotInRank"));
	}

	private boolean setNoRankingOption(boolean noRanking)
	{
		if (this.isGameStarted()) return false;
		this.getParentRoom().setProperty("gameNotInRank", noRanking);
		return true;		
	}
	
	// Added by £ukasz Wyporek 17.03.2015
	public boolean getNoRankingOption()
	{
		Boolean noRankingOption = (Boolean) this.getParentRoom().getProperty("gameNotInRank");
		if (noRankingOption==null)
			return false;
		else
			return noRankingOption;
	}
		
	// Added by £ukasz Wyporek 16.03.2015
	@Override
	public boolean setRoomVisibility(User user, String roomVisibility) 
	{
		// If user isn't room creator he can't change room visibility
		if (!this.isUserRoomCreator(user)) return false;
		return setRoomVisibility(roomVisibility);
	}

	// Added by £ukasz Wyporek 24.03.2015
	private boolean setRoomVisibility() 
	{
		if (this.getParentRoom().getProperty("roomVisibility")==null)
			return this.setRoomVisibility("PUBLIC");
		else
			return this.setRoomVisibility((String)this.getParentRoom().getProperty("roomVisibility"));
	}

	private boolean setRoomVisibility(String roomVisibility)
	{
		if (roomVisibility.equals("PRIVATE"))
			this.getGameRoom().setHidden(true);
		else
			this.getGameRoom().setHidden(false);

		return true;		
	}
	
	// Added by £ukasz Wyporek 16.03.2015
	public String getRoomVisibility() {
		if (this.getGameRoom().isHidden())
		{
			return "PRIVATE";
		}else{
			return "PUBLIC";
		}
	}
	
	
	
	private void timer() {
		

		//trace("Task runnable!");
		if (isGameStarted() && !paused) {
			int place = whoseTurn.getPlayerId() == sitted1Id ? 1 : 2;
			//trace("Current turn: " + place);

			switch (place) {
			case 1:
				time1--;
				break;
			default:
				time2--;
				break;
			}
			ISFSObject resObj = new SFSObject();
			if(sitted1Id < sitted2Id) {
				resObj.putInt("t1", time1);
				resObj.putInt("t2", time2);
			}else{
				resObj.putInt("t1", time2);
				resObj.putInt("t2", time1);
			}
			send("time", resObj, getParentRoom().getUserList());
			
			
			if(time1 == 0 || time2 == 0) {
				int winnerId = time1 == 0?2:1;
				/* 
				 * TODO: check it, maybe add if(sitted1Id < sitted2Id)
				 */
				trace("Winner found: ", winnerId);
				
				// Stop game
				stopGame();

				// Change introduced by £ukasz Wyporek, 14.10.2014
				// Add points to user account in SQL database
				addScoreToPlayersAccounts(1, winnerId);

				// Send update
				ISFSObject respObj = new SFSObject(); 
				respObj.putInt("w", winnerId);
				respObj.putUtfString("s", getGameRoom().getUserByPlayerId(winnerId).getName());
				send("win", respObj, getGameRoom().getUserList());
				
				// Set the last game ending for spectators joining after the end and before a new game starts
				setLastGameEndResponse(new LastGameEndResponse("win", respObj));
				
				// Next turn will be given to the winning user.
				setTurn(getGameRoom().getUserByPlayerId(winnerId));
			}
		}
	}
	GameBoard getGameBoard() {
		return gameBoard;
	}

	User getWhoseTurn() {
		return whoseTurn;
	}

	void setTurn(User user) {
		whoseTurn = user;
	}

	void updateTurn() {
		whoseTurn = getParentRoom().getUserByPlayerId(
				whoseTurn.getPlayerId() == 1 ? 2 : 1);
	}

	public int getMoveCount() {
		return moveCount;
	}

	public void increaseMoveCount() {
		++moveCount;
	}

	public boolean isGameStarted() {
		return gameStarted;
	}

	// Added by £ukasz Wyporek, 15.10.2014
	public long getGameplayId()
	{
		return this.database_id_gameplay;
	}

	// Added by £ukasz Wyporek, 15.10.2014
	public void setGameplayId(long database_id_gameplay)
	{
		this.database_id_gameplay = database_id_gameplay;
	}

	void startGame() {
		if (gameStarted)
			throw new IllegalStateException("Game is already started!");

		lastGameEndResponse = null;
		gameStarted = true;
		gameBoard.reset();
		startTimer();
		
		time1= time2 = this.getGameDuration();
		
		User player1 = getParentRoom().getUserByPlayerId(sitted1Id);
		User player2 = getParentRoom().getUserByPlayerId(sitted2Id);

		canTie1 = true; canTie2 = true;
		
		// No turn assigned? Let's start with player 1
		//if (whoseTurn == null)
		int rand = (int)Math.round(Math.random()+1);		
		
		whoseTurn = getParentRoom().getUserByPlayerId( rand==sitted1Id?sitted1Id:sitted2Id );

		trace("Current turn: "+whoseTurn.getPlayerId());

		// Added by £ukasz Wyporek, 14.10.2014
		// Creating new gameplay ID in database
		IDBManager dbManager = getParentZone().getDBManager();
		Connection connection = null;
		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			
			// Build a prepared statement
			// id_user and internal playerId are different IDs (we can't change internal smartfox's playerId to our user_id)
			PreparedStatement stmt = connection.prepareStatement("INSERT INTO prefix_gameplays(zone_name) VALUES (?)", PreparedStatement.RETURN_GENERATED_KEYS);
			stmt.setString(1, getParentZone().getName());
			// Execute query
			stmt.execute();

			// And now, we are extracting the ID key of the newly inserted row
			ResultSet rs = stmt.getGeneratedKeys();
			if (rs.next()) {
			    setGameplayId(rs.getInt(1));
			}
			
			//ResultSet res = stmt.executeQuery();
			trace("A gameplay record has been added to the database.");

		}catch(SQLException sqle)
		{
	        trace("Database SQL statement error at adding new gameplay record. "+sqle.toString());
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
		// End: Added by £ukasz Wyporek, 14.10.2014
		
		// Send START event to client
		ISFSObject resObj = new SFSObject();
		resObj.putInt("t", whoseTurn.getPlayerId());
		resObj.putUtfString("p1n", player1.getName());
		resObj.putInt("p1i", player1.getId());
		resObj.putUtfString("p2n", player2.getName());
		resObj.putInt("p2i", player2.getId());
		
		send("start", resObj, getParentRoom().getUserList());
	}

	void stopGame() {
		stopGame(false);
	}

	void sittDown(int place, int id) {
		
		switch (place) {
		case 1:
			sitted1 = true;
			sitted1Id = id;
			break;
		case 2:
			sitted2 = true;
			sitted2Id = id;
			break;
		}
	}

	void setReady(int place) {
		trace("Ready id: "+place+" isSitted: "+isSitted(place));
		
		/*if(!isSitted(place)) {
			sittDown(place, )
		}*/
		switch ((place == sitted1Id) ? (sitted1Id) : (sitted2Id)) {
			case 1:
				ready1 = true;
				break;
			case 2:
				ready2 = true;
				break;
		}
	}

	void standUp(int place) {
		switch ((place == sitted1Id) ? (sitted1Id) : (sitted2Id)) {
			case 1:
				ready1 = false;
				sitted1 = false;
				sitted1Id = 0;
				break;
			case 2:
				ready2 = false;
				sitted2 = false;
				sitted2Id = 0;
				break;
		}
	}

	void stopGame(boolean resetTurn) {
		gameStarted = false;
		moveCount = 0;
		whoseTurn = null;
		ready1 = ready2 = false;
		

	}

	Room getGameRoom() {
		return this.getParentRoom();
	}

	LastGameEndResponse getLastGameEndResponse() {
		return lastGameEndResponse;
	}

	void setLastGameEndResponse(LastGameEndResponse lastGameEndResponse) {
		this.lastGameEndResponse = lastGameEndResponse;
	}

	void updateSpectator(User user) {
		ISFSObject resObj = new SFSObject();
		trace("Update spectators!");
		
		User player1 = getParentRoom().getUserByPlayerId(1);
		User player2 = getParentRoom().getUserByPlayerId(2);

		resObj.putInt("t", whoseTurn == null ? 0 : whoseTurn.getPlayerId());
		resObj.putBool("status", gameStarted);
		resObj.putSFSArray("board", gameBoard.getSFSArray());

		if (player1 == null)
			resObj.putInt("p1i", 0); // <--- indicates no P1
		else {
			resObj.putInt("p1i", player1.getId());
			resObj.putUtfString("p1n", player1.getName());
			resObj.putInt("place1", (sitted1Id == 1 ? 1 : 2));
		}

		if (player2 == null)
			resObj.putInt("p2i", 0); // <--- indicates no P2
		else {
			resObj.putInt("p2i", player2.getId());
			resObj.putUtfString("p2n", player2.getName());
			resObj.putInt("place2", (sitted2Id == 2 ? 2 : 1));

		}

		/*
		 * TODO: check if(sitted1Id < sitted2Id)
		 */
		resObj.putInt("t1", getTime(sitted1Id == 1 ? 1 : 2));
		resObj.putInt("t2", getTime(sitted1Id == 1 ? 1 : 2));

		send("specStatus", resObj, user);
	}

	public boolean isSitted(int place) {
		switch (place) {
		case 1:
			return sitted1;
		case 2:
		default:
			return sitted2;
		}

	}

	public int getSittedId(int place) {
		switch (place) {
		case 1:
			return sitted1Id;
		case 2:
		default:
			return sitted2Id;
		}
	}

	public String getSittedName(int place) {
		if(getParentRoom().getUserByPlayerId(place) == null) {
			return "";
		}
		return getParentRoom().getUserByPlayerId(place).getName();
	}

	public boolean isReady(int place) {
		switch (place) {
		case 1:
			return ready1;
		case 2:
		default:
			return ready2;
		}

	}

	public int getTime(int place) {
		switch (place) {
		case 1:
			return time1;
		case 2:
		default:
			return time2;
		}

	}
	
	public boolean canITie(int place) {
		switch (place) {
		case 1:
			return canTie1;
		case 2:
		default:
			return canTie2;
		}

	}
	
	public void setTie(int place) {
		switch (place) {
		case 1:
			canTie1 = false;
			break;
		case 2:
		default:
			canTie2 = false;
		}

	}
	
	public void stopTimer() {
		
		paused = true;
	}
	
	public void startTimer() {
		
		paused = false;
	}


	// Function introduced by £ukasz Wyporek, 11.06
	// Changes: 14.10.2014 this function was moved from MoveHandler to CheckersExtension class
	public void addScoreToPlayersAccounts(Integer amountOfPoints, Integer winnerId)
	{
		// If room has "no ranking" option checked, we don't save the score
		if (this.getNoRankingOption()) // Added 17.03.2015 by £ukasz Wyporek
			return;
		
		// There is only two players, so, if the winner has id=1 then looser must have id=2, and vice-versa
		// But, when the winnerId is 0, this is TIE, and there is no winner
		Integer looserId = winnerId==0?0:(winnerId==1?2:1);

		if (winnerId > 0)
		{
			trace("Adding scores to users account (winner is "+winnerId+", looser is "+looserId+")");
		}else{			
			trace("Adding 0 scores to users account (tie between users)");
		}

		IDBManager dbManager = getParentZone().getDBManager();
		Connection connection = null;
		try
		{
			// Grab a connection from the DBManager connection pool
			connection = dbManager.getConnection();
			if (connection==null)
				trace("Error: A database connection retreived from DBManager is null.");
			
			// Build a prepared statement
			// id_user and internal playerId are different IDs (we can't change internal smartfox's playerId to our user_id)
			PreparedStatement stmt = connection.prepareStatement("INSERT INTO prefix_scores(id_gameplay, id_user, score) VALUES (?, ?, ?), (?, ?, ?)");
			stmt.setLong(1, getGameplayId());
			stmt.setLong(2, (Integer) getGameRoom().getUserByPlayerId(winnerId).getSession().getProperty("php_user_id") );
			stmt.setLong(3, +amountOfPoints);
			stmt.setLong(4, getGameplayId());
			stmt.setLong(5, (Integer) getGameRoom().getUserByPlayerId(looserId).getSession().getProperty("php_user_id") );
			stmt.setLong(6, -amountOfPoints);
			// Execute query
			stmt.execute();
			
			//ResultSet res = stmt.executeQuery();
			if (winnerId > 0)
				trace("A data record has been added to winner's and looser's account.");
			else
				trace("A data record (+0 score) has been added to both accounts (tie).");
				
			PreparedStatement stmt2 = connection.prepareStatement("UPDATE prefix_gameplays SET date_gameplay_ended = CURRENT_TIMESTAMP() WHERE id = ?");
			stmt2.setLong(1, getGameplayId());
			// Execute query
			stmt2.execute();
			
			
		}catch(SQLException sqle)
		{
	        trace("Database SQL statement error at adding scores to the winners and loosers account."+sqle.toString());
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
