package sfs2x.extensions.games.checkers;

import java.util.ArrayList;
//import java.util.Iterator;
import java.util.List;

import com.smartfoxserver.v2.entities.data.ISFSArray;
import com.smartfoxserver.v2.entities.data.SFSArray;

public final class GameBoard {
	private static final int BOARD_SIZE = 8;
	private final Tile[][] board;
	//private final Array[][] history;
	List<int[]> rowList = new ArrayList<int[]>(); // x, y, user
	private int winner = 0;
	private int whitePieces = 12;
	private int blackPieces = 12;
	private int whiteCount = 15;
	private int blackCount = 15;
	private int maxCount = 15;
	private CheckersExtension s;

	// private GomokuExtension s = null;

	public GameBoard(CheckersExtension sfs) {
		 s = sfs;
		board = new Tile[BOARD_SIZE][BOARD_SIZE];
		reset();
	}

	public void setLastMove(int x, int y) {
	}

	Tile getTileAt(int x, int y) {
		return board[y][x];
	}

	public void setTileAt(int y1, int x1, Tile pre_tile, int y2, int x2, Tile tile, int rx, int ry, Tile rt) {
		
		//Tile pre_tile = board[y1][x1];
		board[y1][x1] = Tile.ENABLE;
		board[y2][x2] = tile;
		
		if(rowList.size()-1 > 0){
			int[] temp = rowList.get(rowList.size()-1);
			if(temp[0]!=y1 || temp[1]!=x1|| temp[3]!=y2|| temp[4]!=x2){
				rowList.add(new int[] { y1,x1,pre_tile.getId() ,y2,x2,tile.getId(),   rx,ry,rt.getId() });
				count4Tie(tile, true);
			}else{
				s.trace("--double--removed--");
			}
		}else{
			rowList.add(new int[] { y1,x1,pre_tile.getId() ,y2,x2,tile.getId(),   rx,ry,rt.getId() });
			count4Tie(tile, true);
		}
		//board[rx][ry] = Tile.ENABLE;
		/*if(tile == Tile.RED || tile == Tile.RED_QUEEN){
			blackCount = maxCount -1;
			whitePieces--;
		}else{
			whiteCount = maxCount -1;
			blackPieces--;
		}*/
	}
	
	public void count4Tie(Tile tile, Boolean remove){
		
		if(remove){
			if(tile == Tile.BLACK_QUEEN){
				blackCount = maxCount -1;
				whitePieces--;
			}else if(tile == Tile.WHITE_QUEEN){
				whiteCount = maxCount -1;
				blackPieces--;
			}else if(tile == Tile.BLACK){
				blackCount = maxCount -1;
				whitePieces--;
			}else if(tile == Tile.WHITE){
				whiteCount = maxCount -1;
				blackPieces--;
			}	
		}else{
			if(tile == Tile.BLACK_QUEEN){
				blackCount--;
			}else if(tile == Tile.WHITE_QUEEN){
				whiteCount--;
			}else if(tile == Tile.BLACK){
				blackCount = maxCount -1;
			}else if(tile == Tile.WHITE){
				whiteCount = maxCount -1;
			}
		}
	}
	
	public void setTileAt(int x, int y, Tile tile) {
		board[y][x] = tile;
	}
	
	public void setTileAt(int y1, int x1, Tile pre_tile, int y2, int x2, Tile tile) {
		
		//Tile pre_tile = board[y1][x1];
		board[y1][x1] = Tile.ENABLE;
		board[y2][x2] = tile;
		
		if(rowList.size()-1 > 0){
			int[] temp = rowList.get(rowList.size()-1);
	
			if(temp[0]!=y1 || temp[1]!=x1|| temp[3]!=y2|| temp[4]!=x2){
				rowList.add(new int[] { y1,x1,pre_tile.getId() ,y2,x2,tile.getId() });
				count4Tie(tile, false);
			}else{
				s.trace("--double--removed--");
			}
		}else{
			rowList.add(new int[] { y1,x1,pre_tile.getId() ,y2,x2,tile.getId() });
			count4Tie(tile, false);
		}
			
			/*if(tile == Tile.RED || tile == Tile.RED_QUEEN){
				blackCount--;
			}else{
				whiteCount--;
			}*/
			
	}
	
	public void removeTileAt(int x, int y) {
		board[x][y] = Tile.ENABLE;
		
		//int[] temp = rowList.get(rowList.size()-1);
		//temp.
		//rowList.remove(rowList.size()-1);
		//rowList.add(new int[] { temp[0],temp[1],temp[2],  temp[3],temp[4],temp[5], x,y });
	}
	
	public int[] getLastMove() {
		
		return rowList.get(rowList.size()-1);
	}
	
	public void removeLastMove() {
		
		int[] temp = getLastMove();
		int x1 = temp[0];
		int y1 = temp[1];
		int p1 = temp[2];
		
		int x2 = temp[3];
		int y2 = temp[4];
		int p2 = temp[5];
		
		// set back data
		board[y1][x1] = Tile.getTileById(p1);
		board[y2][x2] = Tile.ENABLE;
		
		
		// return deleted piece
		int rx = -1;//temp[0];
		int ry = -1;//temp[1];
		int rp = -1;//temp[2];
		
		if(temp.length > 6){
			rx = temp[6];
			ry = temp[7];
			rp = temp[8];
			
			board[ry][rx] = Tile.getTileById(rp);
			
			if(Tile.getTileById(p2) == Tile.BLACK || Tile.getTileById(p2) == Tile.BLACK_QUEEN){
				//blackCount --;
				whitePieces++;
			}else{
				//whiteCount--;
				blackPieces++;
			}
		}else{

			
			if(Tile.getTileById(p2) == Tile.BLACK || Tile.getTileById(p2) == Tile.BLACK_QUEEN){
				blackCount++;
			}else{
				whiteCount++;
			}
		}
		s.trace("Remove Last Move: "+getLastMove());
		rowList.remove(getLastMove());
	}
	
	public int moveLength() {
		return rowList.size();
	}

	public int getWinner() {
		return winner;
	}

	public GameState getGameStatus(int moveCount) {

		GameState state = GameState.RUNNING;

		/*if (checkWin(Tile.RED)) {
			state = GameState.END_WITH_WINNER;
			winner = 1;
		}

		else if (checkWin(Tile.WHITE)) {
			state = GameState.END_WITH_WINNER;
			winner = 2;
		}*/

		/*if(blackPieces == 0) {
			state = GameState.END_WITH_WINNER;
			//winner = (s.getSittedId(1) == 1?1:2);
			winner = 1;
		}else if(whitePieces == 0){
			state = GameState.END_WITH_WINNER;
			//winner = (s.getSittedId(1) == 1?2:1);
			winner = 2;
		}*/
		
		//if(countPieces(Tile.RED)+countPieces(Tile.RED_QUEEN) == 0) {
		if(blackPieces == 0) {
			state = GameState.END_WITH_WINNER;
			winner = 1;
			s.trace("BLACK: No more pieces!");
		}else if(whitePieces == 0){	
		//}else if(countPieces(Tile.WHITE)+countPieces(Tile.WHITE_QUEEN) == 0){
			state = GameState.END_WITH_WINNER;
			winner = 2;
			s.trace("WHITE: No more pieces!");
		}else if (winner == 0 && blackCount == 0 && whiteCount == 0){//moveCount == 256)
			state = GameState.END_WITH_TIE;

		}
		// no more moves
		else if(!canMove(Tile.BLACK)){
			state = GameState.END_WITH_WINNER;
			winner = 1;
			s.trace("BLACK: No more moves!");
		}else if(!canMove(Tile.WHITE)){
			state = GameState.END_WITH_WINNER;
			winner = 2;
			s.trace("WHITE: No more moves!");
		}
		
		return state;
	}
	
	public boolean canMove(Tile t){
		
		int[][] m = new int[][] {{-1,-1},{-1,1},{1,-1},{1,1}};
		traceBoard();
		
		if(t == Tile.BLACK){ 
			for (int y = 0; y < BOARD_SIZE; y++) {
				//Tile[] boardRow = board[x];
				for (int x = 0; x < BOARD_SIZE; x++) {
					if( getTileAt(x,y) == Tile.BLACK || getTileAt(x,y) == Tile.BLACK_QUEEN) {
						// move
						if(getTileAt(x,y) == Tile.BLACK) {
							m = new int[][] {{-1,-1},{-1,1}};
						}else{
							m = new int[][] {{-1,-1},{-1,1},{1,-1},{1,1}};
						}
						
						for(int i=0; i<m.length; i++){
							if( (y+m[i][0]>=0) && (y+m[i][0]<BOARD_SIZE) && (x+m[i][1]>=0) && (x+m[i][1]<BOARD_SIZE) ){
								
								if(getTileAt(x+m[i][1], y+m[i][0]) == Tile.ENABLE || getTileAt(x+m[i][1], y+m[i][0]) == Tile.EMPTY){
									s.trace("(BLACK) "+getTileAt(x,y).toString()+": Current pos: "+x+":"+y+" Move at "+(x+m[i][1])+":"+(y+m[i][0]));
									return true;
								}else if(getTileAt(x+m[i][1], y+m[i][0]) == Tile.WHITE || getTileAt(x+m[i][1], y+m[i][0]) == Tile.WHITE_QUEEN){
									
									// beat
									if( (y+m[i][0]+m[i][0]>=0) && (y+m[i][0]+m[i][0]<BOARD_SIZE) && (x+m[i][1]+m[i][1]>=0) && (x+m[i][1]+m[i][1]<BOARD_SIZE) ){
										if(getTileAt(x+m[i][1]+m[i][1], y+m[i][0]+m[i][0]) == Tile.ENABLE || getTileAt(x+m[i][1]+m[i][1], y+m[i][0]+m[i][0]) == Tile.EMPTY){
											s.trace("(BLACK) "+getTileAt(x,y).toString()+": Current pos: "+x+":"+y+" Move at "+(x+m[i][1]+m[i][1])+":"+(y+m[i][0]+m[i][0]));
											return true;
										}
									}
								}
							}
						}
						
					} 
				}
			}
		}else if(t == Tile.WHITE){ 
			for (int y = 0; y < BOARD_SIZE; y++) {
				//Tile[] boardRow = board[x];
				for (int x = 0; x < BOARD_SIZE; x++) {
					if( getTileAt(x,y) == Tile.WHITE || getTileAt(x,y) == Tile.WHITE_QUEEN) {
						// move
						if(getTileAt(x,y) == Tile.WHITE) {
							m = new int[][] {{1,-1},{1,1}};
						}else{
							m = new int[][] {{-1,-1},{-1,1},{1,-1},{1,1}};
						}
						
						for(int i=0; i<m.length; i++){
							if( (y+m[i][0]>=0) && (y+m[i][0]<BOARD_SIZE) && (x+m[i][1]>=0) && (x+m[i][1]<BOARD_SIZE) ){
								
								if(getTileAt(x+m[i][1], y+m[i][0]) == Tile.ENABLE || getTileAt(x+m[i][1], y+m[i][0]) == Tile.EMPTY){
									s.trace("(WHITE) "+getTileAt(x,y).toString()+": Current pos: "+x+":"+y+" Move at "+(x+m[i][1])+":"+(y+m[i][0]));
									return true;
								}else if(getTileAt(x+m[i][1], y+m[i][0]) == Tile.BLACK || getTileAt(x+m[i][1], y+m[i][0]) == Tile.BLACK_QUEEN){
									
									// beat
									if( (y+m[i][0]+m[i][0]>=0) && (y+m[i][0]+m[i][0]<BOARD_SIZE) && (x+m[i][1]+m[i][1]>=0) && (x+m[i][1]+m[i][1]<BOARD_SIZE) ){
										if(getTileAt(x+m[i][1]+m[i][1], y+m[i][0]+m[i][0]) == Tile.ENABLE || getTileAt(x+m[i][1]+m[i][1], y+m[i][0]+m[i][0]) == Tile.EMPTY){
											s.trace("(WHITE) "+getTileAt(x,y).toString()+": Current pos: "+x+":"+y+" Move at "+(x+m[i][1]+m[i][1])+":"+(y+m[i][0]+m[i][0]));
											return true;
										}
									}
								}
							}
						}
						
					} 
				}
			}
		}
		return false;
	}
	
	public int countPieces(Tile tile){
		int count=0;
		
		for (int y = 0; y < BOARD_SIZE; y++) {
			Tile[] boardRow = board[y];

			for (int x = 0; x < BOARD_SIZE; x++) {
				
				if(boardRow[x] == tile){
					count++;
				}
			}
		}
		return count;
	}
	
	public void traceBoard(){
		String tmp = "";
		
		for (int y = 0; y < BOARD_SIZE; y++) {
			tmp += "\n";
			for (int x = 0; x < BOARD_SIZE; x++) {
				tmp += getTileAt(x, y).getId()+" ";
			}
			
		}
		s.trace(tmp);
	}
	public void reset() {
		winner = 0;
		blackCount = whiteCount = maxCount;
		blackPieces=whitePieces=12;
		//String tmp = "";
		
		for (int y = 0; y < BOARD_SIZE; y++) {
			//Tile[] boardRow = board[y];

			for (int x = 0; x < BOARD_SIZE; x++) {
				
				//boardRow[x] = Tile.EMPTY;
				if((y+x)%2 == 1){
					if(y<3){
						setTileAt(x,y, Tile.WHITE);
						//boardRow[x] = Tile.WHITE;
					}else if(y >= BOARD_SIZE-3){
						//boardRow[x] = Tile.BLACK;
						setTileAt(x,y, Tile.BLACK);
					}else{
						setTileAt(x,y, Tile.ENABLE);
					}
				}else{
					setTileAt(x,y, Tile.EMPTY);
				}
				//tmp += ""+getTileAt(x, y).getId();
				
			}
			//s.trace(tmp);
			//tmp = "";
		}
		
		rowList = new ArrayList<int[]>();
	}

	// ::: Private ::::::::::::::::::::::::::::::::::::::::::::::

	ISFSArray getSFSArray() {
		
		ISFSArray sfsa = new SFSArray();

		for(int i=0; i<rowList.size(); i++) {
			//ISFSArray sfsa2 = new SFSArray();
			//sfsa.addShortArray(rowList.get(i));
			//for(int j=0; j<3; i++) {
			List<Short> row = new ArrayList<Short>();
			int[] temp = rowList.get(i);
			//row.add((short)i);
			row.add((short) temp[0] ); //x
			row.add((short) temp[1] ); //y
			row.add((short) temp[2] ); //t
			
			row.add((short) temp[3] ); //x2
			row.add((short) temp[4] ); //y2
			row.add((short) temp[5] ); //t2
			
			if(temp.length > 6) {
				row.add((short) temp[6] ); //x2
				row.add((short) temp[7] ); //y2
				row.add((short) temp[8] ); //t2
			}
			
			sfsa.addShortArray(row);//(rowList.get(i));
		}
		return sfsa;
	}

}
