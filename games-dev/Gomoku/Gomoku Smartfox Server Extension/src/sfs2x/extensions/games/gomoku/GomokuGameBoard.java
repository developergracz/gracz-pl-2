package sfs2x.extensions.games.gomoku;

import java.util.ArrayList;
//import java.util.Iterator;
import java.util.List;

import com.smartfoxserver.v2.entities.data.ISFSArray;
import com.smartfoxserver.v2.entities.data.SFSArray;

public final class GomokuGameBoard {
	private static final int BOARD_SIZE = 16;
	private final Tile[][] board;
	//private final Array[][] history;
	List<int[]> rowList = new ArrayList<int[]>(); // x, y, user
	private int winner = 0;
	private int moveX = 0, moveY = 0;

	// private GomokuExtension s = null;

	public GomokuGameBoard(GomokuExtension sfs) {
		// s = sfs;
		board = new Tile[BOARD_SIZE][BOARD_SIZE];
		reset();
	}

	public void setLastMove(int x, int y) {
		moveX = x;
		moveY = y;
	}

	Tile getTileAt(int x, int y) {
		return board[y][x];
	}

	public void setTileAt(int x, int y, Tile tile) {
		checkCoords(x, y);
		board[y][x] = tile;
		
		if(tile != Tile.EMPTY){
			rowList.add(new int[] { x, y, tile.getId() });
		}else{
			rowList.remove(rowList.size()-1);
		}
	}
	
	public int[] getLastMove() {
		
		return rowList.get(rowList.size()-1);
	}
	
	public int moveLength() {
		return rowList.size();
	}

	public int getWinner() {
		return winner;
	}

	public GameState getGameStatus(int moveCount) {

		GameState state = GameState.RUNNING;

		if (checkWin(Tile.BLACK)) {
			state = GameState.END_WITH_WINNER;
			winner = 1;
		}

		else if (checkWin(Tile.WHITE)) {
			state = GameState.END_WITH_WINNER;
			winner = 2;
		}

		if (winner == 0 && moveCount == 256)
			state = GameState.END_WITH_TIE;

		return state;
	}

	public boolean checkWin(Tile tile) {

		/*int left = Math.max(0, moveX - 5), right = Math.min(BOARD_SIZE - 1,
				moveX + 5), top = Math.max(0, moveY - 5), bottom = Math.min(
				BOARD_SIZE - 1, moveY + 5);*/
		int count = 0;

		System.out.println("Actuall move: " + moveX + ":" + moveY + " tile:"
				+ tile);
	
		
		System.out.println("Checking horizontally:");
		if( checkLane(0, moveX, moveY, 1, 0, -1, 0, tile) >= 6) {
			return true;
		}
		
		
		System.out.println("Checking vertically:");
		if( checkLane(0, moveX, moveY, 0, 1, 0, -1, tile) >= 6 ){
			return true;
		}

		
		System.out.println("Checking top-left to bottom-right:");
		
		
		if( checkLane(count, moveX, moveY, 1, 1, -1, -1, tile) >= 6 ){
			return true;
		}
		
		System.out.println("Checking bottom-left to top-right:");
		
		
		if( checkLane(count, moveX, moveY, 1, -1, -1, 1, tile) >= 6 ){
			return true;
		}

		return false;
	}

	public int checkLane(int c, int x, int y, int mx, int my, int mx2, int my2,  Tile tile) {
		
		int count = 0;
		for(int i=0; i<5; i++) {
			if( x+(i*mx) >= 0 && x+(i*mx) < BOARD_SIZE  &&
					y+(i*my) >= 0 && y+(i*my) < BOARD_SIZE) {
				
				if(board[y+(i*my)][x+(i*mx)] == tile) {
					count ++;
				}else{
					break;
				}
			}else{
				break;
			}
		}
		
		for(int i=0; i<5; i++) {
			if( x+(i*mx2) >= 0 && x+(i*mx2) < BOARD_SIZE  &&
					y+(i*my2) >= 0 && y+(i*my2) < BOARD_SIZE) {
				
				if(board[y+(i*my2)][x+(i*mx2)] == tile) {
					count ++;
				}else{
					break;
				}
			}else{
				break;
			}
		}
		
		
		return count;
	}
	
	public void reset() {
		winner = 0;

		for (int y = 0; y < BOARD_SIZE; y++) {
			Tile[] boardRow = board[y];

			for (int x = 0; x < BOARD_SIZE; x++) {
				boardRow[x] = Tile.EMPTY;
			}
		}
		
		rowList = new ArrayList<int[]>();
	}

	// ::: Private ::::::::::::::::::::::::::::::::::::::::::::::
	private void checkCoords(int x, int y) {
		if (x < 0 || x > BOARD_SIZE - 1)
			throw new IllegalArgumentException("Tile X position out of range: "
					+ x);

		if (y < 0 || y > BOARD_SIZE - 1)
			throw new IllegalArgumentException("Tile Y position out of range: "
					+ y);
	}

	ISFSArray getSFSArray() {
		
		ISFSArray sfsa = new SFSArray();

		for(int i=0; i<rowList.size(); i++) {
			//ISFSArray sfsa2 = new SFSArray();
			//sfsa.addShortArray(rowList.get(i));
			//for(int j=0; j<3; i++) {
			List<Short> row = new ArrayList<Short>();
			int[] temp = rowList.get(i);
			//row.add((short)i);
			row.add((short) temp[0] );
			row.add((short) temp[1] );
			row.add((short) temp[2] );
			
			sfsa.addShortArray(row);//(rowList.get(i));
		}
		return sfsa;
	}
	
	/*ISFSArray toSFSArray() {
		ISFSArray sfsa = new SFSArray();

		for (int y = 0; y < BOARD_SIZE; y++) {
			// Use 1-based indexes for the board
			sfsa.addShortArray(getRowAsList(y));
		}

		return sfsa;
	}

	private List<Short> getRowAsList(int y) {
		List<Short> row = new ArrayList<Short>();

		for (int x = 0; x < BOARD_SIZE; x++)
			row.add((short) board[y][x].getId());

		return row;
	}*/

}
