package sfs2x.extensions.games.gomoku;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;

import com.smartfoxserver.v2.annotations.Instantiation;
import com.smartfoxserver.v2.annotations.Instantiation.InstantiationMode;
import com.smartfoxserver.v2.entities.User;
import com.smartfoxserver.v2.entities.data.ISFSObject;
import com.smartfoxserver.v2.entities.data.SFSObject;
import com.smartfoxserver.v2.exceptions.SFSRuntimeException;
import com.smartfoxserver.v2.extensions.BaseClientRequestHandler;
import com.smartfoxserver.v2.extensions.ExtensionLogLevel;
import com.smartfoxserver.v2.db.*;

@Instantiation(InstantiationMode.SINGLE_INSTANCE)
public class MoveHandler extends BaseClientRequestHandler
{
    private static final String CMD_WIN = "win";
    private static final String CMD_TIE = "tie";
    private static final String CMD_MOVE = "move";
    private static final int BOARD_SIZE = 16;

    @Override
    public void handleClientRequest(User user, ISFSObject params)
    {
        if (!params.containsKey("x") || !params.containsKey("y"))
            throw new SFSRuntimeException("Invalid request, one mandatory param is missing. Required 'x' and 'y'");

        GomokuExtension gameExt = (GomokuExtension) getParentExtension();
        GomokuGameBoard board = gameExt.getGameBoard();

        int moveX = params.getInt("x");
        int moveY = params.getInt("y");

        if (moveX < 0 || moveX >= BOARD_SIZE || moveY < 0 || moveY >= BOARD_SIZE) {
            gameExt.trace(ExtensionLogLevel.WARN, "Rejected out-of-range move from " + user + ": (" + moveX + "," + moveY + ")");
            return;
        }
        if (!gameExt.isGameStarted()) {
            gameExt.trace(ExtensionLogLevel.WARN, "Rejected move because game is not started: " + user);
            return;
        }
        if (gameExt.getWhoseTurn() != user) {
            gameExt.trace(ExtensionLogLevel.WARN, "Wrong turn. Expected: " + gameExt.getWhoseTurn() + ", received from: " + user);
            return;
        }
        if (board.getTileAt(moveX, moveY) != Tile.EMPTY) {
            gameExt.trace(ExtensionLogLevel.WARN, "Rejected move to occupied tile: (" + moveX + "," + moveY + ")");
            return;
        }

        Tile tile = user.getPlayerId() == 1 ? Tile.BLACK : Tile.WHITE;
        gameExt.trace(String.format("Handling valid move from player %s. (%s, %s)", user.getPlayerId(), moveX, moveY));

        board.setLastMove(moveX, moveY);
        board.setTileAt(moveX, moveY, tile);
        persistAcceptedMove(gameExt, user, moveX, moveY, tile);

        ISFSObject respObj = new SFSObject();
        respObj.putInt("x", moveX);
        respObj.putInt("y", moveY);
        respObj.putInt("t", user.getPlayerId());
        send(CMD_MOVE, respObj, gameExt.getGameRoom().getUserList());

        gameExt.increaseMoveCount();
        gameExt.updateTurn();
        checkBoardState(gameExt);
    }

    private void persistAcceptedMove(GomokuExtension gameExt, User user, int moveX, int moveY, Tile tile)
    {
        IDBManager dbManager = getParentExtension().getParentZone().getDBManager();
        Connection connection = null;
        PreparedStatement stmt = null;
        try {
            connection = dbManager.getConnection();
            if (connection == null) {
                trace("Database connection is null; accepted move will not be persisted.");
                return;
            }
            stmt = connection.prepareStatement("INSERT LOW_PRIORITY INTO prefix_moves(id_gameplay, id_user, move) VALUES (?, ?, ?)");
            stmt.setLong(1, gameExt.getGameplayId());
            Object phpUserId = gameExt.getGameRoom().getUserByPlayerId(user.getPlayerId()).getSession().getProperty("php_user_id");
            if (!(phpUserId instanceof Integer)) {
                trace("Missing php_user_id for accepted move; move will not be persisted.");
                return;
            }
            stmt.setLong(2, ((Integer) phpUserId).longValue());
            stmt.setString(3, "(" + moveX + "," + moveY + ") = " + tile);
            stmt.executeUpdate();
        } catch (SQLException sqle) {
            trace("Database SQL statement error when trying to add accepted move record. " + sqle.toString());
        } finally {
            if (stmt != null) {
                try { stmt.close(); } catch (SQLException ignored) { }
            }
            if (connection != null) {
                try { connection.close(); } catch (SQLException ignored) { }
            }
        }
    }

    private void checkBoardState(GomokuExtension gameExt)
    {
        GameState state = gameExt.getGameBoard().getGameStatus(gameExt.getMoveCount());

        if (state == GameState.END_WITH_WINNER)
        {
            int winnerId = gameExt.getGameBoard().getWinner();
            gameExt.trace("Winner found: ", winnerId);
            gameExt.stopGame();

            ISFSObject respObj = new SFSObject();
            respObj.putInt("w", winnerId);
            respObj.putUtfString("s", gameExt.getGameRoom().getUserByPlayerId(winnerId).getName());
            gameExt.send(CMD_WIN, respObj, gameExt.getGameRoom().getUserList());
            gameExt.addScoreToPlayersAccounts(1, winnerId);
            gameExt.setLastGameEndResponse(new LastGameEndResponse(CMD_WIN, respObj));
            gameExt.setTurn(gameExt.getGameRoom().getUserByPlayerId(winnerId));
        }
        else if (state == GameState.END_WITH_TIE)
        {
            gameExt.trace("TIE!");
            gameExt.stopGame();
            ISFSObject respObj = new SFSObject();
            gameExt.send(CMD_TIE, respObj, gameExt.getGameRoom().getUserList());
            gameExt.addScoreToPlayersAccounts(0,1);
            gameExt.setLastGameEndResponse(new LastGameEndResponse(CMD_TIE, respObj));
        }
    }
}
