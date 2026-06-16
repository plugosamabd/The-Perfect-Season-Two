// Additional (era, team) rosters merged into the master ROSTER.
// Keeps the main roster.ts readable. Format identical to raw/EXTRA there.

import type { Era } from "./roster";

type RawTeam = Array<[string, number, boolean?]>;

export const EXTRA_TEAMS: Record<Era, Record<string, RawTeam>> = {
  "60s": {
    "Hawks": [
      ["Bob Pettit", 96, true], ["Cliff Hagan", 86, true], ["Lenny Wilkens", 86, true],
      ["Lou Hudson", 80], ["Zelmo Beaty", 80], ["Bill Bridges", 78], ["Joe Caldwell", 78],
      ["Walt Hazzard", 76], ["Paul Silas", 74], ["Richie Guerin", 80],
    ],
    "Kings": [
      ["Oscar Robertson", 96, true], ["Jerry Lucas", 88, true], ["Jack Twyman", 84],
      ["Wayne Embry", 80], ["Adrian Smith", 76], ["Tom Hawkins", 74],
      ["Connie Dierking", 72], ["Happy Hairston", 74], ["Bob Boozer", 76], ["Arlen Bockhorn", 72],
    ],
    "Wizards": [
      ["Walt Bellamy", 88, true], ["Gus Johnson", 86, true], ["Earl Monroe", 90, true],
      ["Jack Marin", 78], ["Kevin Loughery", 76], ["Fred Carter", 76],
      ["LeRoy Ellis", 72], ["Bob Ferry", 72], ["Don Ohl", 76], ["Rod Thorn", 70],
    ],
  },
  "70s": {
    "Wizards": [
      ["Wes Unseld", 90, true], ["Elvin Hayes", 92, true], ["Bob Dandridge", 86, true],
      ["Phil Chenier", 84], ["Kevin Grevey", 78], ["Greg Ballard", 76],
      ["Mitch Kupchak", 76], ["Tom Henderson", 74], ["Larry Wright", 72], ["Charles Johnson", 72],
    ],
    "Suns": [
      ["Paul Westphal", 88, true], ["Alvan Adams", 84, true], ["Walter Davis", 84],
      ["Dick Van Arsdale", 78], ["Connie Hawkins", 82], ["Gar Heard", 74],
      ["Curtis Perry", 72], ["Ricky Sobers", 74], ["Don Buse", 74], ["Keith Erickson", 72],
    ],
    "Bulls": [
      ["Bob Love", 86, true], ["Chet Walker", 84, true], ["Jerry Sloan", 80],
      ["Norm Van Lier", 80], ["Tom Boerwinkle", 74], ["Artis Gilmore", 90, true],
      ["Reggie Theus", 82], ["Mickey Johnson", 74], ["Wilbur Holland", 72], ["Scott May", 76],
    ],
  },
  "80s": {
    "Hawks": [
      ["Dominique Wilkins", 94, true], ["Spud Webb", 78], ["Doc Rivers", 82],
      ["Kevin Willis", 80], ["Tree Rollins", 74], ["Cliff Levingston", 72],
      ["Randy Wittman", 74], ["Antoine Carr", 76], ["Mike Glenn", 72], ["Jon Koncak", 70],
    ],
    "Trail Blazers": [
      ["Clyde Drexler", 92, true], ["Terry Porter", 84], ["Jerome Kersey", 80],
      ["Buck Williams", 80], ["Kevin Duckworth", 78], ["Mychal Thompson", 76],
      ["Jim Paxson", 78], ["Drazen Petrovic", 80], ["Kiki Vandeweghe", 80], ["Steve Johnson", 74],
    ],
    "Mavericks": [
      ["Rolando Blackman", 86, true], ["Mark Aguirre", 86, true], ["Derek Harper", 82],
      ["Sam Perkins", 80], ["James Donaldson", 76], ["Detlef Schrempf", 80],
      ["Brad Davis", 74], ["Roy Tarpley", 80], ["Jay Vincent", 74], ["Wallace Bryant", 70],
    ],
    "Bucks": [
      ["Sidney Moncrief", 90, true], ["Marques Johnson", 86, true], ["Terry Cummings", 84],
      ["Jack Sikma", 82], ["Paul Pressey", 78], ["Ricky Pierce", 80],
      ["Bob Lanier", 84], ["Junior Bridgeman", 78], ["Craig Hodges", 74], ["Mike Dunleavy Sr.", 72],
    ],
  },
  "90s": {
    "Thunder": [
      ["Gary Payton", 92, true], ["Shawn Kemp", 91, true], ["Detlef Schrempf", 84],
      ["Hersey Hawkins", 80], ["Sam Perkins", 76], ["Nate McMillan", 76],
      ["Vincent Askew", 72], ["Ervin Johnson", 72], ["Frank Brickowski", 70], ["Eric Snow", 72],
    ],
    "Hornets": [
      ["Alonzo Mourning", 90, true], ["Larry Johnson", 88, true], ["Muggsy Bogues", 80],
      ["Dell Curry", 80], ["Glen Rice", 86, true], ["Kendall Gill", 78],
      ["Hersey Hawkins", 78], ["David Wingate", 72], ["Anthony Mason", 82], ["Bobby Phills", 76],
    ],
    "Pacers": [
      ["Reggie Miller", 92, true], ["Rik Smits", 84], ["Mark Jackson", 82],
      ["Dale Davis", 78], ["Antonio Davis", 76], ["Jalen Rose", 82],
      ["Travis Best", 72], ["Derrick McKey", 76], ["Chris Mullin", 80], ["Sam Perkins", 76],
    ],
    "Suns": [
      ["Charles Barkley", 95, true], ["Kevin Johnson", 88, true], ["Dan Majerle", 82],
      ["Tom Chambers", 84], ["Cedric Ceballos", 80], ["Danny Ainge", 78],
      ["Wesley Person", 76], ["Mark West", 72], ["Jason Kidd", 88, true], ["Antonio McDyess", 80],
    ],
    "Timberwolves": [
      ["Kevin Garnett", 92, true], ["Stephon Marbury", 84], ["Tom Gugliotta", 82],
      ["Sam Mitchell", 78], ["Doug West", 76], ["Christian Laettner", 80],
      ["Isaiah Rider", 80], ["Terry Porter", 76], ["Anthony Peeler", 74], ["Bobby Jackson", 76],
    ],
    "Knicks": [
      ["Patrick Ewing", 93, true], ["John Starks", 82, true], ["Charles Oakley", 80],
      ["Anthony Mason", 82], ["Allan Houston", 84], ["Latrell Sprewell", 84],
      ["Larry Johnson", 82], ["Marcus Camby", 80], ["Derek Harper", 78], ["Chris Childs", 74],
    ],
  },
  "2000s": {
    "Suns": [
      ["Steve Nash", 95, true], ["Amar'e Stoudemire", 90, true], ["Shawn Marion", 86, true],
      ["Joe Johnson", 82], ["Quentin Richardson", 78], ["Leandro Barbosa", 78],
      ["Boris Diaw", 76], ["Raja Bell", 76], ["Grant Hill", 84], ["Jason Richardson", 80],
    ],
    "Kings": [
      ["Chris Webber", 90, true], ["Mike Bibby", 86, true], ["Peja Stojakovic", 86, true],
      ["Vlade Divac", 84], ["Doug Christie", 80], ["Bobby Jackson", 78],
      ["Hedo Turkoglu", 78], ["Brad Miller", 80], ["Ron Artest", 82], ["Bonzi Wells", 76],
    ],
    "Timberwolves": [
      ["Kevin Garnett", 96, true], ["Sam Cassell", 84], ["Latrell Sprewell", 82],
      ["Wally Szczerbiak", 82], ["Troy Hudson", 76], ["Trenton Hassell", 72],
      ["Anthony Peeler", 74], ["Mark Madsen", 66], ["Fred Hoiberg", 74], ["Ervin Johnson", 70],
    ],
    "Raptors": [
      ["Vince Carter", 94, true], ["Chris Bosh", 88, true], ["Morris Peterson", 76],
      ["Jose Calderon", 80], ["Andrea Bargnani", 80], ["Anthony Parker", 74],
      ["T.J. Ford", 76], ["Jermaine O'Neal", 80], ["Antonio Davis", 76], ["Charles Oakley", 74],
    ],
    "Nets": [
      ["Jason Kidd", 92, true], ["Vince Carter", 92, true], ["Richard Jefferson", 84, true],
      ["Kenyon Martin", 82], ["Kerry Kittles", 78], ["Lucious Harris", 74],
      ["Aaron Williams", 72], ["Jason Collins", 72], ["Brian Scalabrine", 70], ["Devin Harris", 78],
    ],
  },
  "2010s": {
    "Clippers": [
      ["Chris Paul", 92, true], ["Blake Griffin", 90, true], ["DeAndre Jordan", 84, true],
      ["J.J. Redick", 80], ["Jamal Crawford", 80], ["Lou Williams", 80],
      ["Matt Barnes", 74], ["Caron Butler", 74], ["Tobias Harris", 82], ["Patrick Beverley", 78],
    ],
    "Hawks": [
      ["Al Horford", 86, true], ["Joe Johnson", 86, true], ["Jeff Teague", 80],
      ["Paul Millsap", 84], ["Kyle Korver", 80], ["DeMarre Carroll", 76],
      ["Mike Scott", 72], ["Dennis Schroder", 76], ["Thabo Sefolosha", 74], ["Tiago Splitter", 72],
    ],
    "Hornets": [
      ["Kemba Walker", 88, true], ["Al Jefferson", 82], ["Nicolas Batum", 80],
      ["Marvin Williams", 76], ["Cody Zeller", 74], ["Jeremy Lin", 78],
      ["Michael Kidd-Gilchrist", 72], ["Frank Kaminsky", 72], ["Gerald Henderson", 76], ["Courtney Lee", 76],
    ],
    "Pelicans": [
      ["Anthony Davis", 94, true], ["Jrue Holiday", 84, true], ["DeMarcus Cousins", 90, true],
      ["Tyreke Evans", 80], ["E'Twaun Moore", 74], ["Solomon Hill", 70],
      ["Darius Miller", 70], ["Quincy Pondexter", 72], ["Eric Gordon", 80], ["Ryan Anderson", 78],
    ],
    "Pacers": [
      ["Paul George", 92, true], ["Roy Hibbert", 84, true], ["David West", 82],
      ["Lance Stephenson", 78], ["George Hill", 76], ["Danny Granger", 80],
      ["Ian Mahinmi", 72], ["C.J. Watson", 70], ["Victor Oladipo", 86], ["Myles Turner", 80],
    ],
    "Wizards": [
      ["John Wall", 90, true], ["Bradley Beal", 88, true], ["Marcin Gortat", 80],
      ["Otto Porter Jr.", 78], ["Markieff Morris", 76], ["Trevor Ariza", 78],
      ["Bojan Bogdanovic", 78], ["Kelly Oubre Jr.", 76], ["Nene", 74], ["Andre Miller", 76],
    ],
    "Raptors": [
      ["Kyle Lowry", 88, true], ["DeMar DeRozan", 88, true], ["Kawhi Leonard", 96, true],
      ["Pascal Siakam", 84], ["Marc Gasol", 82], ["Fred VanVleet", 80],
      ["Serge Ibaka", 80], ["Danny Green", 78], ["Norman Powell", 76], ["OG Anunoby", 78],
    ],
    "Nets": [
      ["Deron Williams", 84, true], ["Joe Johnson", 84], ["Brook Lopez", 84],
      ["Paul Pierce", 84], ["Kevin Garnett", 82], ["Andray Blatche", 76],
      ["Shaun Livingston", 74], ["Mason Plumlee", 74], ["D'Angelo Russell", 82], ["Spencer Dinwiddie", 80],
    ],
    "Grizzlies": [
      ["Marc Gasol", 90, true], ["Mike Conley", 86, true], ["Zach Randolph", 86, true],
      ["Tony Allen", 80], ["Tayshaun Prince", 76], ["Vince Carter", 80],
      ["JaMychal Green", 74], ["Courtney Lee", 76], ["Rudy Gay", 84], ["O.J. Mayo", 78],
    ],
  },
  "2020s": {
    "Suns": [
      ["Devin Booker", 92, true], ["Kevin Durant", 96, true], ["Bradley Beal", 84],
      ["Chris Paul", 86, true], ["Deandre Ayton", 84], ["Mikal Bridges", 82],
      ["Cameron Johnson", 78], ["Cam Payne", 74], ["Jusuf Nurkic", 78], ["Grayson Allen", 76],
    ],
    "Clippers": [
      ["Kawhi Leonard", 92, true], ["Paul George", 90, true], ["James Harden", 86],
      ["Russell Westbrook", 82], ["Ivica Zubac", 78], ["Norman Powell", 78],
      ["Terance Mann", 74], ["Bones Hyland", 72], ["Marcus Morris Sr.", 76], ["Reggie Jackson", 76],
    ],
    "Hornets": [
      ["LaMelo Ball", 90, true], ["Miles Bridges", 82, true], ["Terry Rozier", 80],
      ["Gordon Hayward", 78], ["Mason Plumlee", 72], ["Brandon Miller", 80],
      ["Nick Richards", 74], ["P.J. Washington", 80], ["Cody Martin", 72], ["Kelly Oubre Jr.", 76],
    ],
    "Pelicans": [
      ["Zion Williamson", 92, true], ["Brandon Ingram", 88, true], ["CJ McCollum", 84],
      ["Herbert Jones", 80], ["Jonas Valanciunas", 80], ["Trey Murphy III", 78],
      ["Larry Nance Jr.", 76], ["Naji Marshall", 74], ["Jose Alvarado", 76], ["Dyson Daniels", 74],
    ],
    "Pacers": [
      ["Tyrese Haliburton", 92, true], ["Pascal Siakam", 86, true], ["Myles Turner", 82],
      ["Bennedict Mathurin", 80], ["Andrew Nembhard", 78], ["Aaron Nesmith", 78],
      ["Obi Toppin", 74], ["T.J. McConnell", 74], ["Buddy Hield", 78], ["Jalen Smith", 72],
    ],
    "Timberwolves": [
      ["Anthony Edwards", 94, true], ["Karl-Anthony Towns", 90, true], ["Rudy Gobert", 88, true],
      ["Mike Conley", 82], ["Naz Reid", 80], ["Jaden McDaniels", 80],
      ["Nickeil Alexander-Walker", 76], ["Kyle Anderson", 74], ["Jordan McLaughlin", 72], ["Monte Morris", 74],
    ],
    "Raptors": [
      ["Pascal Siakam", 86, true], ["Scottie Barnes", 86, true], ["OG Anunoby", 82],
      ["Fred VanVleet", 84], ["Gary Trent Jr.", 78], ["Chris Boucher", 74],
      ["Precious Achiuwa", 72], ["Immanuel Quickley", 82], ["RJ Barrett", 80], ["Jakob Poeltl", 78],
    ],
    "Nets": [
      ["Kevin Durant", 96, true], ["Kyrie Irving", 92, true], ["James Harden", 92, true],
      ["Mikal Bridges", 84], ["Cam Thomas", 80], ["Nicolas Claxton", 80],
      ["Day'Ron Sharpe", 72], ["Spencer Dinwiddie", 78], ["Ben Simmons", 80], ["Joe Harris", 76],
    ],
    "Wizards": [
      ["Jordan Poole", 80], ["Kyle Kuzma", 82, true], ["Tyus Jones", 78],
      ["Deni Avdija", 78], ["Daniel Gafford", 78], ["Bilal Coulibaly", 76],
      ["Corey Kispert", 74], ["Marvin Bagley III", 72], ["Kristaps Porzingis", 84], ["Kentavious Caldwell-Pope", 78],
    ],
    "Grizzlies": [
      ["Ja Morant", 94, true], ["Jaren Jackson Jr.", 88, true], ["Desmond Bane", 86, true],
      ["Steven Adams", 80], ["Dillon Brooks", 78], ["Tyus Jones", 78],
      ["Brandon Clarke", 78], ["Santi Aldama", 76], ["Marcus Smart", 82], ["Luke Kennard", 76],
    ],
  },
};
