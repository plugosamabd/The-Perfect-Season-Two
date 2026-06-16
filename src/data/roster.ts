// Curated NBA roster by era + team.
// Ratings are 65-99. "wow" flag = legendary tier.

export type Era = "60s" | "70s" | "80s" | "90s" | "2000s" | "2010s" | "2020s";
export const ERAS: Era[] = ["60s", "70s", "80s", "90s", "2000s", "2010s", "2020s"];

export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

const POSITION_OVERRIDES: Record<string, Position[]> = {
  "Magic Johnson": ["PG","SG"], "Kareem Abdul-Jabbar": ["C"], "James Worthy": ["SF","PF"],
  "Larry Bird": ["SF","PF"], "Kevin McHale": ["PF","C"], "Robert Parish": ["C"],
  "Michael Jordan": ["SG","SF"], "Scottie Pippen": ["SF","SG","PF"], "Dennis Rodman": ["PF","C"],
  "Hakeem Olajuwon": ["C"], "Tim Duncan": ["PF","C"], "Shaquille O'Neal": ["C"],
  "Kobe Bryant": ["SG","SF"], "LeBron James": ["SF","PF","SG"], "Stephen Curry": ["PG"],
  "Klay Thompson": ["SG","SF"], "Kevin Durant": ["SF","PF"], "Draymond Green": ["PF","C","SF"],
  "Nikola Jokic": ["C"], "Giannis Antetokounmpo": ["PF","C","SF"], "Damian Lillard": ["PG"],
  "Luka Doncic": ["PG","SG"], "Kyrie Irving": ["PG","SG"], "Jayson Tatum": ["SF","PF"],
  "Jaylen Brown": ["SG","SF"], "Anthony Davis": ["PF","C"], "Karl Malone": ["PF"],
  "John Stockton": ["PG"], "Charles Barkley": ["PF","C"], "Julius Erving": ["SF"],
  "Moses Malone": ["C"], "Isiah Thomas": ["PG"], "Joe Dumars": ["SG"], "Bill Laimbeer": ["C"],
  "Dirk Nowitzki": ["PF","C"], "Steve Nash": ["PG"], "Jason Kidd": ["PG"],
  "Dwyane Wade": ["SG","PG"], "Chris Paul": ["PG"], "James Harden": ["SG","PG"],
  "Russell Westbrook": ["PG"], "Kawhi Leonard": ["SF","SG"], "Pau Gasol": ["PF","C"],
  "Chris Bosh": ["PF","C"], "Kevin Love": ["PF","C"], "Manu Ginobili": ["SG"],
  "Tony Parker": ["PG"], "Chauncey Billups": ["PG"], "Richard Hamilton": ["SG"],
  "Ben Wallace": ["C","PF"], "Rasheed Wallace": ["PF","C"], "Tayshaun Prince": ["SF"],
  "Shai Gilgeous-Alexander": ["PG","SG"], "Chet Holmgren": ["C","PF"],
  "Jalen Williams": ["SF","SG"], "Jamal Murray": ["PG","SG"], "Aaron Gordon": ["PF","SF"],
  "Michael Porter Jr.": ["SF","PF"], "Jrue Holiday": ["PG","SG"], "Khris Middleton": ["SF","SG"],
  "Andrew Wiggins": ["SF","SG"], "Kristaps Porzingis": ["C","PF"], "Al Horford": ["C","PF"],
  "Derrick White": ["PG","SG"], "Penny Hardaway": ["PG","SG"], "Gary Payton": ["PG"],
  "Shawn Kemp": ["PF","C"], "Ralph Sampson": ["C","PF"], "Clyde Drexler": ["SG","SF"],
  "Brook Lopez": ["C","PF"], "Bobby Portis": ["PF","C"],
  "Daniel Gafford": ["C","PF"], "Dereck Lively II": ["C","PF"], "Austin Reaves": ["SG","PG"],
  "D'Angelo Russell": ["PG","SG"],
  // 60s / 70s
  "Bill Russell": ["C"], "Bob Cousy": ["PG"], "John Havlicek": ["SG","SF"], "Sam Jones": ["SG"],
  "Bill Sharman": ["SG"], "Tom Heinsohn": ["PF","C"], "Jerry West": ["PG","SG"],
  "Elgin Baylor": ["SF","PF"], "Wilt Chamberlain": ["C"], "Nate Thurmond": ["C"],
  "Rick Barry": ["SF"], "Walt Frazier": ["PG","SG"], "Willis Reed": ["C","PF"],
  "Dave DeBusschere": ["PF","SF"], "Bill Bradley": ["SF","SG"], "Earl Monroe": ["PG","SG"],
  "Jerry Lucas": ["PF","C"], "Dave Cowens": ["C","PF"], "Jo Jo White": ["PG","SG"],
  "Paul Silas": ["PF","C"], "Charlie Scott": ["SG","PG"], "Paul Westphal": ["PG","SG"],
  "Oscar Robertson": ["PG","SG"], "Bob Dandridge": ["SF","PF"], "Bill Walton": ["C"],
  "Maurice Lucas": ["PF","C"], "Lionel Hollins": ["PG","SG"], "Gail Goodrich": ["PG","SG"],
  "Billy Cunningham": ["SF","PF"], "Hal Greer": ["SG","PG"], "Chet Walker": ["SF"],
  "Paul Arizin": ["SF","SG"], "Connie Hawkins": ["SF","PF"],
  // newer additions
  "Reggie Miller": ["SG"], "Vince Carter": ["SG","SF"], "Tracy McGrady": ["SG","SF"],
  "Paul George": ["SF","SG","PF"], "Ja Morant": ["PG"], "LaMelo Ball": ["PG","SG"],
  "Tyrese Haliburton": ["PG"], "Kyle Lowry": ["PG"], "DeMar DeRozan": ["SG","SF"],
  "Bradley Beal": ["SG"], "John Wall": ["PG"], "Kemba Walker": ["PG"],
  "Anthony Edwards": ["SG","SF"], "Zion Williamson": ["PF","SF"], "Brandon Ingram": ["SF","PF"],
  "CJ McCollum": ["SG","PG"], "Devin Booker": ["SG","PG"], "Deandre Ayton": ["C","PF"],
  "Mikal Bridges": ["SF","SG"], "Karl-Anthony Towns": ["C","PF"], "Rudy Gobert": ["C"],
  "Jaren Jackson Jr.": ["PF","C"], "Desmond Bane": ["SG"], "Scottie Barnes": ["SF","PF"],
  "Pascal Siakam": ["PF","SF"], "OG Anunoby": ["SF","PF"], "Fred VanVleet": ["PG","SG"],
  "Marc Gasol": ["C"], "Mike Conley": ["PG"], "Zach Randolph": ["PF","C"],
  "Blake Griffin": ["PF","C"],
  "Chris Webber": ["PF","C"], "Vlade Divac": ["C"], "Brad Miller": ["C"],
  "Mike Bibby": ["PG"], "Peja Stojakovic": ["SF","SG"], "Kevin Garnett": ["PF","C"],
  "Stephon Marbury": ["PG"], "Amar'e Stoudemire": ["PF","C"],
  "Shawn Marion": ["SF","PF"], "Kevin Johnson": ["PG"],
  "Bob Pettit": ["PF","C"], "Cliff Hagan": ["SF","PF"], "Lenny Wilkens": ["PG"],
  "Wes Unseld": ["C","PF"], "Elvin Hayes": ["PF","C"], "Walt Bellamy": ["C"],
  "Gus Johnson": ["PF","SF"], "Bob Love": ["SF","PF"], "Artis Gilmore": ["C"],
  "Dominique Wilkins": ["SF","SG"], "Spud Webb": ["PG"], "Doc Rivers": ["PG","SG"],
  "Sidney Moncrief": ["SG","SF"], "Terry Porter": ["PG"],
  "Patrick Ewing": ["C"], "John Starks": ["SG"], "Allan Houston": ["SG"],
  "Latrell Sprewell": ["SG","SF"], "Anthony Mason": ["PF","SF","C"],
  "Larry Johnson": ["PF","SF"], "Muggsy Bogues": ["PG"],
  "Dell Curry": ["SG"], "Glen Rice": ["SF","SG"],
  "Richard Jefferson": ["SF"], "Kenyon Martin": ["PF","C"],
  "DeMarcus Cousins": ["C","PF"], "Kyle Kuzma": ["PF","SF"],
};



const BIG_MAN_PLAYERS = new Set([
  "A.C. Green","Adrian Dantley","Al Horford","Alonzo Mourning","Anthony Davis","Aron Baynes",
  "Aaron Gordon","Bill Cartwright","Bill Laimbeer","Bill Walton","Bobby Portis","Boban Marjanovic",
  "Caldwell Jones","Charles Barkley","Charles Oakley","Chet Holmgren","Chris Andersen","Chris Bosh",
  "Corie Blount","Daniel Gafford","DeAndre Jordan","Dennis Rodman","Dereck Lively II","Dirk Nowitzki",
  "Dwight Howard","Elden Campbell","Enes Kanter","Fabricio Oberto","Felton Spencer","Greg Ostertag",
  "Greg Kite","Giannis Antetokounmpo","Hakeem Olajuwon","Hasheem Thabeet","Horace Grant",
  "Isaiah Hartenstein","Jaxson Hayes","James Worthy","Jeff Ayres","Jermaine O'Neal","Joakim Noah",
  "John Salley","Kareem Abdul-Jabbar","Kevin Love","Kevin McHale","Kurt Rambis","Kristaps Porzingis",
  "Kwame Brown","Larry Bird","Lamar Odom","LaMarcus Aldridge","Mark Aguirre","Michael Cage",
  "Moses Malone","Mychal Thompson","Nazr Mohammed","Nikola Jokic","P.J. Washington","Pau Gasol",
  "Petur Gudmundsson","Rasheed Wallace","Ralph Sampson","Robert Parish","Shaquille O'Neal",
  "Shawn Kemp","Steven Adams","Tim Duncan","Tyson Chandler","Udonis Haslem","Zydrunas Ilgauskas",
  "Zaza Pachulia",
  // 60s/70s bigs
  "Bill Russell","Wilt Chamberlain","Nate Thurmond","Willis Reed","Dave Cowens","Maurice Lucas",
  "Tom Heinsohn","Jerry Lucas","Luke Jackson","Johnny Kerr","Mel Counts","Clifford Ray",
  "George Johnson","Lloyd Neal","Paul Silas","Happy Hairston","Nate Bowman","Dave Stallworth",
  // additional bigs
  "Bob Pettit","Walt Bellamy","Wes Unseld","Elvin Hayes","Zelmo Beaty","Wayne Embry","Bob Boozer",
  "Connie Dierking","Gus Johnson","LeRoy Ellis","Bob Ferry","Artis Gilmore","Tom Boerwinkle",
  "Mitch Kupchak","Larry Wright","Kevin Willis","Tree Rollins","Cliff Levingston","Jon Koncak",
  "Buck Williams","Kevin Duckworth","Steve Johnson","James Donaldson","Roy Tarpley",
  "Jack Sikma","Bob Lanier","Chris Webber","Vlade Divac","Brad Miller","Kevin Garnett",
  "Christian Laettner","Tom Gugliotta","Karl-Anthony Towns","Rudy Gobert","Naz Reid",
  "Andrea Bargnani","Kenyon Martin","Mason Plumlee","Nicolas Claxton","Day'Ron Sharpe",
  "Marcin Gortat","Marc Gasol","Zach Randolph","Jaren Jackson Jr.","Brandon Clarke","Santi Aldama",
  "JaMychal Green","Jonas Valanciunas","Larry Nance Jr.","Rik Smits","Antonio Davis","Dale Davis",
  "Roy Hibbert","Ian Mahinmi","Myles Turner","Obi Toppin","Blake Griffin","Ivica Zubac",
  "Amar'e Stoudemire","Tom Chambers","Mark West","Alvan Adams","Deandre Ayton","Jusuf Nurkic",
  "Patrick Ewing","Anthony Mason","Marcus Camby","Alonzo Mourning","Larry Johnson","Kevin Willis",
  "Jakob Poeltl","Precious Achiuwa","Scottie Barnes","Pascal Siakam","Marvin Bagley III",
  "Daniel Theis","Zion Williamson","Jaxson Hayes","Karl Malone","DeMarcus Cousins",
]);


import NBA_POSITIONS from "./nba/positions.json";
import NBA_ROSTERS from "./nba/rosters.json";

const NBA_POS = NBA_POSITIONS as Record<string, Position[]>;
const NBA_ROST = NBA_ROSTERS as Record<string, Record<string, string[]>>;

export function getPositions(name: string): Position[] {
  const normalized = name.trim();
  const base =
    POSITION_OVERRIDES[normalized] ??
    NBA_POS[normalized] ??
    (BIG_MAN_PLAYERS.has(normalized) ? (["PF", "C"] as Position[]) : (["PG", "SG", "SF"] as Position[]));
  const set = new Set<Position>(base);
  if (set.has("C")) set.add("PF");
  if (set.has("PF")) set.add("C");
  return POSITIONS.filter((p) => set.has(p));
}

export interface Player {
  name: string;
  team: string;
  era: Era;
  rating: number;
  wow?: boolean;
}

// Era boost added to a team's per-game win probability.
// Older eras get a bigger boost since modern players already have higher ratings.
export const ERA_BOOST: Record<Era, number> = {
  "60s": 0.07,
  "70s": 0.06,
  "80s": 0.05,
  "90s": 0.04,
  "2000s": 0.03,
  "2010s": 0.02,
  "2020s": 0.01,
};

// Each NBA team gets a primary + accent color so cards can be visually coded.
export const TEAM_COLORS: Record<string, { primary: string; accent: string }> = {
  "Lakers":        { primary: "#552583", accent: "#FDB927" },
  "Celtics":       { primary: "#007A33", accent: "#FFFFFF" },
  "Pistons":       { primary: "#C8102E", accent: "#1D42BA" },
  "76ers":         { primary: "#006BB6", accent: "#ED174C" },
  "Rockets":       { primary: "#CE1141", accent: "#FFFFFF" },
  "Bulls":         { primary: "#CE1141", accent: "#FFFFFF" },
  "Jazz":          { primary: "#002B5C", accent: "#F9A01B" },
  "Magic":         { primary: "#0077C0", accent: "#C4CED4" },
  "SuperSonics":   { primary: "#006633", accent: "#FFC200" },
  "Spurs":         { primary: "#1F1F1F", accent: "#C4CED4" },
  "Heat":          { primary: "#98002E", accent: "#F9A01B" },
  "Mavericks":     { primary: "#00538C", accent: "#B8C4CA" },
  "Cavaliers":     { primary: "#860038", accent: "#FDBB30" },
  "Warriors":      { primary: "#1D428A", accent: "#FFC72C" },
  "Thunder":       { primary: "#007AC1", accent: "#EF3B24" },
  "Nuggets":       { primary: "#0E2240", accent: "#FEC524" },
  "Bucks":         { primary: "#00471B", accent: "#EEE1C6" },
  "Knicks":        { primary: "#006BB6", accent: "#F58426" },
  "Trail Blazers": { primary: "#E03A3E", accent: "#FFFFFF" },
  "Hawks":         { primary: "#E03A3E", accent: "#C1D32F" },
  "Hornets":       { primary: "#1D1160", accent: "#00788C" },
  "Pelicans":      { primary: "#0C2340", accent: "#C8102E" },
  "Pacers":        { primary: "#002D62", accent: "#FDBB30" },
  "Clippers":      { primary: "#C8102E", accent: "#1D428A" },
  "Suns":          { primary: "#1D1160", accent: "#E56020" },
  "Kings":         { primary: "#5A2D81", accent: "#63727A" },
  "Timberwolves":  { primary: "#0C2340", accent: "#78BE20" },
  "Raptors":       { primary: "#CE1141", accent: "#FFFFFF" },
  "Nets":          { primary: "#000000", accent: "#FFFFFF" },
  "Wizards":       { primary: "#002B5C", accent: "#E31837" },
  "Grizzlies":     { primary: "#5D76A9", accent: "#F5B112" },
};

// All 30 franchises that appear on the team wheel (alphabetical).
export const TEAM_LIST: string[] = [
  "76ers","Bucks","Bulls","Cavaliers","Celtics","Clippers","Grizzlies","Hawks","Heat","Hornets",
  "Jazz","Kings","Knicks","Lakers","Magic","Mavericks","Nets","Nuggets","Pacers","Pelicans",
  "Pistons","Raptors","Rockets","Spurs","Suns","Thunder","Timberwolves","Trail Blazers","Warriors","Wizards",
];


type RawTeam = Array<[string, number, boolean?]>;
const raw: Record<Era, Record<string, RawTeam>> = {
  "60s": {
    "Celtics": [
      ["Bill Russell", 97, true], ["Bob Cousy", 90, true], ["John Havlicek", 92, true],
      ["Sam Jones", 88, true], ["Bill Sharman", 84], ["Tom Heinsohn", 86],
      ["K.C. Jones", 80], ["Frank Ramsey", 80], ["Tom Sanders", 76], ["Don Nelson", 76],
    ],
    "Lakers": [
      ["Jerry West", 96, true], ["Elgin Baylor", 95, true], ["Wilt Chamberlain", 96, true],
      ["Gail Goodrich", 84], ["Happy Hairston", 78], ["Keith Erickson", 74],
      ["Mel Counts", 72], ["Jim McMillian", 78], ["Dick Garrett", 72], ["Tom Hawkins", 72],
    ],
    "76ers": [
      ["Wilt Chamberlain", 97, true], ["Hal Greer", 90, true], ["Billy Cunningham", 88, true],
      ["Chet Walker", 84], ["Luke Jackson", 78], ["Wali Jones", 76],
      ["Larry Costello", 76], ["Matt Guokas", 72], ["Dave Gambee", 72], ["Johnny Kerr", 74],
    ],
    "Warriors": [
      ["Wilt Chamberlain", 95, true], ["Nate Thurmond", 90, true], ["Rick Barry", 92, true],
      ["Paul Arizin", 84], ["Tom Meschery", 76], ["Al Attles", 78],
      ["Guy Rodgers", 80], ["Jeff Mullins", 80], ["Jim King", 74], ["Fred Hetzel", 72],
    ],
    "Knicks": [
      ["Walt Frazier", 93, true], ["Willis Reed", 92, true], ["Dave DeBusschere", 88, true],
      ["Bill Bradley", 84], ["Dick Barnett", 82], ["Cazzie Russell", 78],
      ["Mike Riordan", 74], ["Phil Jackson", 72], ["Dave Stallworth", 74], ["Nate Bowman", 70],
    ],
  },
  "70s": {
    "Knicks": [
      ["Walt Frazier", 94, true], ["Willis Reed", 90, true], ["Earl Monroe", 88, true],
      ["Dave DeBusschere", 87], ["Bill Bradley", 84], ["Jerry Lucas", 84],
      ["Dick Barnett", 80], ["Phil Jackson", 74], ["Cazzie Russell", 78], ["Henry Bibby", 74],
    ],
    "Lakers": [
      ["Wilt Chamberlain", 96, true], ["Jerry West", 94, true], ["Gail Goodrich", 88, true],
      ["Happy Hairston", 78], ["Jim McMillian", 80], ["Pat Riley", 74],
      ["Keith Erickson", 74], ["Flynn Robinson", 74], ["Connie Hawkins", 80], ["Lucius Allen", 76],
    ],
    "Celtics": [
      ["John Havlicek", 94, true], ["Dave Cowens", 92, true], ["Jo Jo White", 88, true],
      ["Paul Silas", 84], ["Don Nelson", 78], ["Don Chaney", 76],
      ["Charlie Scott", 84], ["Paul Westphal", 80], ["Steve Kuberski", 70], ["Tom Sanders", 72],
    ],
    "Bucks": [
      ["Kareem Abdul-Jabbar", 98, true], ["Oscar Robertson", 92, true], ["Bob Dandridge", 86],
      ["Jon McGlocklin", 78], ["Lucius Allen", 76], ["Bob Boozer", 76],
      ["Greg Smith", 72], ["Curtis Perry", 74], ["Mickey Davis", 72], ["Wali Jones", 72],
    ],
    "Warriors": [
      ["Rick Barry", 95, true], ["Nate Thurmond", 88], ["Jamaal Wilkes", 84],
      ["Phil Smith", 82], ["Clifford Ray", 76], ["Charles Dudley", 70],
      ["Butch Beard", 76], ["Derrek Dickey", 72], ["George Johnson", 72], ["Charles Johnson", 74],
    ],
    "Trail Blazers": [
      ["Bill Walton", 94, true], ["Maurice Lucas", 88, true], ["Lionel Hollins", 82],
      ["Bob Gross", 78], ["Dave Twardzik", 76], ["Lloyd Neal", 74],
      ["Larry Steele", 72], ["Johnny Davis", 76], ["Herm Gilliam", 72], ["Corky Calhoun", 70],
    ],
  },
  "80s": {
    "Lakers": [
      ["Magic Johnson", 98, true], ["Kareem Abdul-Jabbar", 95, true], ["James Worthy", 88, true],
      ["Byron Scott", 82], ["A.C. Green", 78], ["Michael Cooper", 80], ["Kurt Rambis", 74],
      ["Bob McAdoo", 82], ["Jamaal Wilkes", 80], ["Mychal Thompson", 78],
    ],
    "Celtics": [
      ["Larry Bird", 98, true], ["Kevin McHale", 91, true], ["Robert Parish", 88, true],
      ["Dennis Johnson", 84], ["Danny Ainge", 80], ["Bill Walton", 82], ["Cedric Maxwell", 78],
      ["Tiny Archibald", 80], ["Gerald Henderson", 74], ["Scott Wedman", 72],
    ],
    "Pistons": [
      ["Isiah Thomas", 94, true], ["Joe Dumars", 88, true], ["Dennis Rodman", 86],
      ["Bill Laimbeer", 84], ["Vinnie Johnson", 80], ["Adrian Dantley", 86], ["Mark Aguirre", 82],
      ["John Salley", 76], ["James Edwards", 75], ["Rick Mahorn", 76],
    ],
    "76ers": [
      ["Julius Erving", 94, true], ["Moses Malone", 92, true], ["Charles Barkley", 90, true],
      ["Andrew Toney", 82], ["Maurice Cheeks", 81], ["Bobby Jones", 80], ["Clint Richardson", 72],
      ["Caldwell Jones", 74], ["Mike Gminski", 76], ["Ron Anderson", 74],
    ],
    "Rockets": [
      ["Hakeem Olajuwon", 93, true], ["Ralph Sampson", 86], ["Robert Reid", 76],
      ["Rodney McCray", 75], ["Mitchell Wiggins", 72], ["Lewis Lloyd", 74], ["John Lucas", 76],
      ["Allen Leavell", 72], ["Jim Petersen", 70], ["Sleepy Floyd", 80],
    ],
    "Bulls": [
      ["Michael Jordan", 96, true], ["Scottie Pippen", 84], ["Charles Oakley", 80],
      ["Horace Grant", 78], ["John Paxson", 75], ["Bill Cartwright", 76], ["Craig Hodges", 74],
      ["B.J. Armstrong", 74], ["Stacey King", 70], ["Cliff Levingston", 70],
    ],
  },
  "90s": {
    "Bulls": [
      ["Michael Jordan", 99, true], ["Scottie Pippen", 94, true], ["Dennis Rodman", 89, true],
      ["Toni Kukoc", 84], ["Steve Kerr", 78], ["Ron Harper", 80], ["Luc Longley", 76],
      ["Horace Grant", 84], ["B.J. Armstrong", 78], ["Bill Wennington", 70],
    ],
    "Rockets": [
      ["Hakeem Olajuwon", 97, true], ["Clyde Drexler", 90, true], ["Robert Horry", 82],
      ["Kenny Smith", 80], ["Mario Elie", 76], ["Sam Cassell", 80], ["Otis Thorpe", 82],
      ["Vernon Maxwell", 78], ["Charles Jones", 70], ["Matt Bullard", 72],
    ],
    "Jazz": [
      ["Karl Malone", 95, true], ["John Stockton", 93, true], ["Jeff Hornacek", 84],
      ["Bryon Russell", 78], ["Greg Ostertag", 72], ["Antoine Carr", 74], ["Howard Eisley", 74],
      ["Shandon Anderson", 72], ["Adam Keefe", 70], ["Chris Morris", 72],
    ],
    "Lakers": [
      ["Shaquille O'Neal", 96, true], ["Kobe Bryant", 90, true], ["Eddie Jones", 82],
      ["Nick Van Exel", 80], ["Robert Horry", 78], ["Glen Rice", 84], ["Rick Fox", 76],
      ["Derek Fisher", 74], ["A.C. Green", 75], ["Elden Campbell", 76],
    ],
    "Magic": [
      ["Shaquille O'Neal", 95, true], ["Penny Hardaway", 92, true], ["Nick Anderson", 82],
      ["Horace Grant", 80], ["Dennis Scott", 78], ["Brian Shaw", 74], ["Donald Royal", 70],
      ["Jeff Turner", 70], ["Anthony Bowie", 70], ["Tree Rollins", 70],
    ],
    "SuperSonics": [
      ["Gary Payton", 92, true], ["Shawn Kemp", 91, true], ["Detlef Schrempf", 84],
      ["Hersey Hawkins", 80], ["Sam Perkins", 76], ["Nate McMillan", 76], ["Vincent Askew", 72],
      ["Ervin Johnson", 72], ["Frank Brickowski", 70], ["Eric Snow", 72],
    ],
  },
  "2000s": {
    "Lakers": [
      ["Kobe Bryant", 98, true], ["Shaquille O'Neal", 97, true], ["Pau Gasol", 88, true],
      ["Lamar Odom", 84], ["Derek Fisher", 78], ["Andrew Bynum", 82], ["Trevor Ariza", 78],
      ["Ron Artest", 80], ["Sasha Vujacic", 72], ["Luke Walton", 72],
    ],
    "Spurs": [
      ["Tim Duncan", 97, true], ["Tony Parker", 88, true], ["Manu Ginobili", 89, true],
      ["Bruce Bowen", 78], ["Robert Horry", 76], ["David Robinson", 88], ["Stephen Jackson", 78],
      ["Brent Barry", 76], ["Michael Finley", 76], ["Fabricio Oberto", 70],
    ],
    "Pistons": [
      ["Chauncey Billups", 89, true], ["Richard Hamilton", 85], ["Ben Wallace", 86, true],
      ["Rasheed Wallace", 86], ["Tayshaun Prince", 82], ["Lindsey Hunter", 74], ["Antonio McDyess", 78],
      ["Mike James", 74], ["Elden Campbell", 72], ["Mehmet Okur", 78],
    ],
    "Heat": [
      ["Dwyane Wade", 94, true], ["Shaquille O'Neal", 90, true], ["Alonzo Mourning", 82],
      ["Antoine Walker", 80], ["Udonis Haslem", 76], ["James Posey", 76], ["Gary Payton", 80],
      ["Jason Williams", 74], ["Eddie Jones", 78], ["Damon Jones", 72],
    ],
    "Mavericks": [
      ["Dirk Nowitzki", 95, true], ["Steve Nash", 90, true], ["Michael Finley", 82],
      ["Jason Terry", 84], ["Josh Howard", 80], ["Jerry Stackhouse", 80], ["Jason Kidd", 86],
      ["Erick Dampier", 74], ["DeSagana Diop", 70], ["Devin Harris", 78],
    ],
    "Cavaliers": [
      ["LeBron James", 96, true], ["Mo Williams", 80], ["Zydrunas Ilgauskas", 80],
      ["Anderson Varejao", 76], ["Delonte West", 75], ["Larry Hughes", 78], ["Drew Gooden", 76],
      ["Daniel Gibson", 74], ["Sasha Pavlovic", 72], ["Eric Snow", 72],
    ],
  },
  "2010s": {
    "Warriors": [
      ["Stephen Curry", 98, true], ["Klay Thompson", 92, true], ["Kevin Durant", 97, true],
      ["Draymond Green", 88, true], ["Andre Iguodala", 82], ["Harrison Barnes", 80],
      ["Shaun Livingston", 76], ["David West", 78], ["Zaza Pachulia", 72], ["JaVale McGee", 74],
    ],
    "Heat": [
      ["LeBron James", 99, true], ["Dwyane Wade", 92, true], ["Chris Bosh", 88, true],
      ["Ray Allen", 82], ["Mario Chalmers", 76], ["Shane Battier", 78], ["Udonis Haslem", 74],
      ["Mike Miller", 76], ["Norris Cole", 72], ["Chris Andersen", 74],
    ],
    "Spurs": [
      ["Tim Duncan", 90, true], ["Tony Parker", 88, true], ["Manu Ginobili", 86],
      ["Kawhi Leonard", 92, true], ["LaMarcus Aldridge", 88], ["Danny Green", 78],
      ["Patty Mills", 76], ["Boris Diaw", 76], ["Tiago Splitter", 74], ["Pau Gasol", 84],
    ],
    "Thunder": [
      ["Kevin Durant", 95, true], ["Russell Westbrook", 93, true], ["James Harden", 86, true],
      ["Serge Ibaka", 82], ["Steven Adams", 80], ["Kendrick Perkins", 74], ["Reggie Jackson", 78],
      ["Nick Collison", 72], ["Thabo Sefolosha", 74], ["Enes Kanter", 78],
    ],
    "Cavaliers": [
      ["LeBron James", 98, true], ["Kyrie Irving", 91, true], ["Kevin Love", 87, true],
      ["Tristan Thompson", 80], ["J.R. Smith", 78], ["Iman Shumpert", 76], ["Channing Frye", 74],
      ["Richard Jefferson", 74], ["Matthew Dellavedova", 72], ["Timofey Mozgov", 74],
    ],
    "Rockets": [
      ["James Harden", 95, true], ["Chris Paul", 91, true], ["Clint Capela", 84],
      ["Eric Gordon", 82], ["P.J. Tucker", 78], ["Ryan Anderson", 76], ["Trevor Ariza", 78],
      ["Gerald Green", 74], ["Nene", 74], ["Luc Mbah a Moute", 72],
    ],
  },
  "2020s": {
    "Nuggets": [
      ["Nikola Jokic", 99, true], ["Jamal Murray", 89, true], ["Aaron Gordon", 84],
      ["Michael Porter Jr.", 84], ["Kentavious Caldwell-Pope", 78], ["Bruce Brown", 76],
      ["Jeff Green", 74], ["Christian Braun", 74], ["DeAndre Jordan", 72], ["Reggie Jackson", 74],
    ],
    "Bucks": [
      ["Giannis Antetokounmpo", 98, true], ["Damian Lillard", 92, true], ["Khris Middleton", 86, true],
      ["Jrue Holiday", 86], ["Brook Lopez", 80], ["Bobby Portis", 80], ["Pat Connaughton", 74],
      ["Grayson Allen", 76], ["George Hill", 72], ["Wesley Matthews", 74],
    ],
    "Warriors": [
      ["Stephen Curry", 96, true], ["Klay Thompson", 86, true], ["Draymond Green", 84],
      ["Andrew Wiggins", 82], ["Jordan Poole", 80], ["Kevon Looney", 76], ["Gary Payton II", 76],
      ["Otto Porter Jr.", 74], ["Andre Iguodala", 74], ["Jonathan Kuminga", 78],
    ],
    "Celtics": [
      ["Jayson Tatum", 95, true], ["Jaylen Brown", 91, true], ["Kristaps Porzingis", 86, true],
      ["Jrue Holiday", 86], ["Derrick White", 84], ["Al Horford", 82], ["Sam Hauser", 74],
      ["Payton Pritchard", 76], ["Robert Williams III", 78], ["Luke Kornet", 72],
    ],
    "Lakers": [
      ["LeBron James", 94, true], ["Anthony Davis", 93, true], ["Austin Reaves", 82],
      ["D'Angelo Russell", 82], ["Rui Hachimura", 78], ["Jarred Vanderbilt", 76],
      ["Taurean Prince", 74], ["Gabe Vincent", 74], ["Cam Reddish", 74], ["Max Christie", 72],
    ],
    "Mavericks": [
      ["Luka Doncic", 97, true], ["Kyrie Irving", 90, true], ["P.J. Washington", 82],
      ["Daniel Gafford", 80], ["Dereck Lively II", 78], ["Tim Hardaway Jr.", 78],
      ["Josh Green", 74], ["Maxi Kleber", 74], ["Dante Exum", 74], ["Derrick Jones Jr.", 76],
    ],
    "Thunder": [
      ["Shai Gilgeous-Alexander", 97, true], ["Chet Holmgren", 88, true], ["Jalen Williams", 88, true],
      ["Lu Dort", 80], ["Isaiah Hartenstein", 80], ["Cason Wallace", 78], ["Aaron Wiggins", 76],
      ["Isaiah Joe", 76], ["Kenrich Williams", 74], ["Alex Caruso", 80],
    ],
  },
};

const EXTRA: Record<Era, Record<string, RawTeam>> = {
  "60s": {},
  "70s": {},
  "80s": {
    "Lakers": [["Norm Nixon", 80], ["Spencer Haywood", 76], ["Jim Chones", 72], ["Mike McGee", 70]],
    "Celtics": [["M.L. Carr", 74], ["Quinn Buckner", 72], ["Jerry Sichting", 72], ["Sam Vincent", 70]],
    "Pistons": [["John Long", 72], ["Kelly Tripucka", 80], ["Earl Cureton", 70], ["Sidney Green", 70]],
    "76ers": [["Steve Mix", 74], ["Lionel Hollins", 76], ["Sedale Threatt", 74], ["Leon Wood", 70]],
    "Rockets": [["Purvis Short", 80], ["Buck Johnson", 72], ["Frank Johnson", 72], ["Larry Smith", 72]],
    "Bulls": [["Dave Corzine", 72], ["Quintin Dailey", 76], ["Rod Higgins", 72], ["Brad Sellers", 70]],
  },
  "90s": {
    "Bulls": [["John Paxson", 76], ["Bill Cartwright", 78], ["Will Perdue", 70], ["Jud Buechler", 70]],
    "Rockets": [["Mario Elie", 78], ["Eddie Johnson", 76], ["Brent Price", 70], ["Chucky Brown", 70]],
    "Jazz": [["Tom Chambers", 78], ["David Benoit", 72], ["John Crotty", 68], ["Antoine Carr", 74]],
    "Lakers": [["Travis Knight", 70], ["Byron Scott", 78], ["Jon Barry", 72], ["Tyronn Lue", 72]],
    "Magic": [["Don MacLean", 70], ["Donald Royal", 70], ["Geert Hammink", 64], ["Anthony Avent", 68]],
    "SuperSonics": [["Kendall Gill", 78], ["Michael Cage", 74], ["David Wingate", 70], ["Sherman Douglas", 74]],
  },
  "2000s": {
    "Lakers": [["Rick Fox", 76], ["Devean George", 72], ["Smush Parker", 72], ["Jordan Farmar", 74]],
    "Spurs": [["Malik Rose", 74], ["Steve Smith", 76], ["Kurt Thomas", 74], ["Matt Bonner", 72]],
    "Pistons": [["Corliss Williamson", 74], ["Carlos Arroyo", 72], ["Maurice Evans", 70], ["Flip Murray", 72]],
    "Heat": [["Rasual Butler", 72], ["Michael Beasley", 78], ["Mario Chalmers", 76], ["Jason Kapono", 74]],
    "Mavericks": [["Shawn Marion", 84], ["Tyson Chandler", 80], ["J.J. Barea", 76], ["Caron Butler", 80]],
    "Cavaliers": [["Boobie Gibson", 74], ["Ben Wallace", 80], ["Wally Szczerbiak", 76], ["Donyell Marshall", 74]],
  },
  "2010s": {
    "Warriors": [["Festus Ezeli", 72], ["Leandro Barbosa", 74], ["Nick Young", 74], ["Quinn Cook", 72]],
    "Heat": [["Joel Anthony", 70], ["James Jones", 72], ["Rashard Lewis", 76], ["Juwan Howard", 70]],
    "Spurs": [["Marco Belinelli", 76], ["Aron Baynes", 74], ["Cory Joseph", 72], ["Matt Bonner", 72]],
    "Thunder": [["Derek Fisher", 74], ["Nazr Mohammed", 72], ["Eric Maynor", 70], ["Kendrick Perkins", 72]],
    "Cavaliers": [["Mo Williams", 78], ["Mike Miller", 74], ["James Jones", 72], ["Anderson Varejao", 76]],
    "Rockets": [["Patrick Beverley", 78], ["Corey Brewer", 74], ["Jason Terry", 76], ["Josh Smith", 76]],
  },
  "2020s": {
    "Nuggets": [["Monte Morris", 76], ["Will Barton", 76], ["Paul Millsap", 76], ["Justin Holiday", 72]],
    "Bucks": [["Donte DiVincenzo", 78], ["Pat Connaughton", 74], ["Bobby Portis", 78], ["Joe Ingles", 72]],
    "Warriors": [["Moses Moody", 76], ["Brandin Podziemski", 78], ["Chris Paul", 84], ["Buddy Hield", 78]],
    "Celtics": [["Marcus Smart", 84], ["Malcolm Brogdon", 80], ["Aaron Nesmith", 72], ["Daniel Theis", 72]],
    "Lakers": [["Dennis Schroder", 78], ["Russell Westbrook", 82], ["Carmelo Anthony", 78], ["Dwight Howard", 78]],
    "Mavericks": [["Spencer Dinwiddie", 76], ["Christian Wood", 76], ["Reggie Bullock", 74], ["Jalen Brunson", 84]],
    "Thunder": [["Josh Giddey", 80], ["Tre Mann", 72], ["Darius Bazley", 72], ["Mike Muscala", 72]],
  },
};

import { EXTRA_TEAMS } from "./extra-rosters";

function mergeRoster(): Player[] {
  const out: Player[] = [];
  const seen = new Set<string>();
  function push(era: Era, team: string, name: string, rating: number, wow?: boolean) {
    const k = `${era}|${team}|${name}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name, team, era, rating, wow: !!wow });
  }
  for (const era of ERAS) {
    const base = raw[era] ?? {};
    const extra = EXTRA[era] ?? {};
    const more = EXTRA_TEAMS[era] ?? {};
    const teamSet = new Set<string>([...Object.keys(base), ...Object.keys(extra), ...Object.keys(more)]);
    for (const team of teamSet) {
      for (const [name, rating, wow] of (base[team] ?? [])) push(era, team, name as string, rating as number, wow);
      for (const [name, rating, wow] of (extra[team] ?? [])) push(era, team, name as string, rating as number, wow);
      for (const [name, rating, wow] of (more[team] ?? [])) push(era, team, name as string, rating as number, wow);
    }
  }
  return out;
}

export const ROSTER: Player[] = mergeRoster();

// Eras that have at least one roster for the given team.
export function erasForTeam(team: string): Era[] {
  const set = new Set<Era>();
  for (const p of ROSTER) if (p.team === team) set.add(p.era);
  return ERAS.filter((e) => set.has(e));
}

// Teams that have at least one roster across all eras.
export const TEAMS_WITH_ROSTER: string[] = TEAM_LIST.filter((t) => erasForTeam(t).length > 0);

export const ERAS_TEAMS: Record<Era, string[]> = ERAS.reduce((acc, era) => {
  const set = new Set<string>();
  for (const p of ROSTER) if (p.era === era) set.add(p.team);
  acc[era] = Array.from(set);
  return acc;
}, {} as Record<Era, string[]>);

export interface WheelSegment {
  era: Era;
  team: string;
}

// Legacy combined wheel kept for any older callers.
export const WHEEL_SEGMENTS: WheelSegment[] = ERAS.flatMap(era =>
  ERAS_TEAMS[era].map(team => ({ era, team }))
);

export function getPlayersFor(era: Era, team: string): Player[] {
  return ROSTER.filter(p => p.era === era && p.team === team);
}

export function pickRandomEra(): Era {
  return ERAS[Math.floor(Math.random() * ERAS.length)];
}
export function pickRandomTeam(era: Era): string {
  const teams = ERAS_TEAMS[era];
  return teams[Math.floor(Math.random() * teams.length)];
}

export function teamColor(team: string): { primary: string; accent: string } {
  return TEAM_COLORS[team] ?? { primary: "#3b82f6", accent: "#1e3a8a" };
}

