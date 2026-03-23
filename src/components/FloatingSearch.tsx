"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchEntry {
  spotifyId: string;
  name: string;
  searchTokens: string[];
  imageUrl: string | null;
  genres: string[];
}

const ALIAS_MAP: Record<string, string[]> = {
  "015B": ["공일오비"],
  "10cm": ["10CM"],
  "2NE1": ["투애니원"],
  "2PM": ["투피엠"],
  "3RACHA": ["쓰리라차"],
  "5RACHA": ["파이브라차"],
  "9 and the Numbers": ["구와 더 넘버즈"],
  "朴俊元": ["pH-1"],
  "任載範": ["임재범"],
  "ABTB;Jo Gyouhyun": ["ABTB"],
  "achime": ["Achime"],
  "Adios Audio": ["아디오스 오디오"],
  "ADOY": ["아도이"],
  "AKMU": ["악동뮤지션", "악뮤"],
  "Aleph": ["알레프"],
  "An Jaewook": ["안재욱"],
  "And": ["김지환", "앤드"],
  "AOA": ["에이오에이"],
  "Art of Noise": ["Noise"],
  "Aseul": ["아슬"],
  "Aurora Ave.": ["오로라 애비뉴"],
  "B612": ["비육일이"],
  "BADLAMB": ["배드램"],
  "Bank": ["뱅크"],
  "Beenzino": ["빈지노"],
  "Bibi Blocksberg": ["비비"],
  "BIGBANG": ["빅뱅"],
  "Black Hole": ["블랙홀"],
  "BLACKPINK": ["블랙핑크", "블핑"],
  "Blah Blah Blah": ["blah"],
  "Block B": ["블락비"],
  "Bosudongcooler": ["보수동쿨러"],
  "Bosudongcooler;hathaw9y": ["Bosudongcooler"],
  "BreadBeat": ["원정호"],
  "Breeze": ["브리즈"],
  "Broken Valentine": ["브로큰 발렌타인"],
  "Bronze": ["김휘동", "브론즈"],
  "Bruno Mars": ["브루노 마스"],
  "BTOB": ["비투비"],
  "BTOB 4U": ["비투비 포유"],
  "BTS": ["방탄소년단", "방탄"],
  "Budung": ["부등"],
  "Bursters": ["BURSTERS"],
  "C Jamm": ["씨잼", "C JAMM"],
  "Cadejo": ["CADEJO"],
  "Can": ["CAN"],
  "Car Seat Headrest": ["CAR"],
  "Chamsom": ["참깨와 솜사탕"],
  "Charlie jung Band": ["찰리정밴드"],
  "Cho Jang Hyuck": ["조장혁"],
  "Choi Jae Hoon": ["최재훈"],
  "Choi Min woo": ["최민우"],
  "Choi Yong Jun": ["최용준"],
  "Chuli & Miae": ["철이와 미애"],
  "Circle": ["써클"],
  "Clon": ["클론"],
  "CNBLUE": ["씨엔블루"],
  "Coin Classic": ["coin classic"],
  "cotoba": ["코토바"],
  "CRASH": ["크래쉬"],
  "Cymbals;内田晴元;小泉一郎": ["Cymbals"],
  "dahlia": ["Dahlia"],
  "Daniel Barenboim": ["DANIEL"],
  "Decadent": ["DECADENT"],
  "Deli Spice": ["델리스파이스"],
  "DELISPICE": ["델리스파이스"],
  "Deux": ["듀스"],
  "DJ DOC": ["디제이독"],
  "DJ Pumkin": ["DJ 펌킨"],
  "Don Mills": ["던밀스"],
  "dosii": ["도시"],
  "Dynamic Duo": ["다이나믹듀오", "다이나믹 듀오"],
  "Eclipse": ["ECLIPSE"],
  "Epik High": ["에픽하이"],
  "Exhibition": ["전람회"],
  "EXID": ["이엑스아이디"],
  "EXO": ["엑소"],
  "f(x)": ["에프엑스"],
  "Faces": ["장기하와 얼굴들"],
  "FAKE UNIVERSE": ["페이크 유니버스"],
  "Falcon": ["팔콘"],
  "Five Sense": ["파이브 센스"],
  "Fucked Up": ["UP"],
  "G-Dragon": ["권지용"],
  "Galaxy Express": ["갤럭시 익스프레스"],
  "Gate Flowers": ["게이트 플라워즈"],
  "Genie": ["지니"],
  "GgoiJjaDeul": ["꽃자들"],
  "Girls’ Generation": ["소녀시대"],
  "Glen Check": ["글렌체크"],
  "Godo": ["이고도"],
  "Goodmorning Pancake": ["굿모닝 팬케이크"],
  "GOT7": ["갓세븐"],
  "GSoul": ["골든"],
  "Guckkasten": ["국카스텐"],
  "H.O.T.": ["에이치오티"],
  "H2O": ["에이치투오"],
  "HAEPAARY": ["해파리"],
  "HANRORO": ["한로로"],
  "Harlequin": ["할리퀸"],
  "Hathaw9y": ["hathaw9y"],
  "Heart": ["줄리아하트"],
  "Heekyung Na": ["HeeKyung Na"],
  "Heize": ["장다혜", "헤이즈"],
  "HERD": ["허드"],
  "Hexagonal Water": ["육각수"],
  "huijun woo": ["우희준"],
  "Hwal Band": ["활"],
  "HYUN JIN YOUNG": ["현진영"],
  "Hyunyi with Cinderella": ["현이와 신데렐라"],
  "i‐dle": ["(여자)아이들", "아이들", "여자아이들"],
  "Illest Konfusion": ["일리스트 컨퓨젼"],
  "Ilmin Choi;DAYBREAK": ["Ilmin Choi"],
  "In Ho Ohm;Yi Chul Choi;Chan Kweun Ju": ["In Ho Ohm"],
  "In Kwon Jeon": ["전인권"],
  "IU": ["아이유", "이지은"],
  "IZI": ["Izi"],
  "J-HOPE": ["정호석", "제이홉"],
  "j‐hope": ["정호석"],
  "Jang YoonJu": ["장윤주"],
  "JENNIE": ["김제니", "제니"],
  "Jeon Jin Hee;wave to earth": ["Jeon Jin Hee"],
  "JEON SOYEON": ["소연"],
  "Jeong Hongil": ["정홍일"],
  "JEONGMILLA": ["정밀아"],
  "JIMIN": ["박지민", "지민"],
  "JIN": ["김석진", "진"],
  "JINI": ["지니", "최윤진"],
  "jisokuryClub": ["지속류클럽"],
  "JISOO": ["Kim Ji-soo", "김지수", "지수"],
  "jo dongik": ["조동익"],
  "Joha": ["JOHA"],
  "John Cranfield": ["Cranfield"],
  "Juk Juk": ["이적"],
  "Junesun Kim": ["김준선"],
  "JUNG KOOK": ["전정국", "정국"],
  "Jung-A Lee": ["선우정아"],
  "Kaede;Lamp;UWANOSORA": ["Kaede"],
  "Kang Sunghee": ["강성희"],
  "Kang Tae-Hwan": ["Kang Tae Hwan"],
  "Keeproots": ["이근수", "킵루츠"],
  "Kim Hyun Jung": ["김현정"],
  "Kim Hyun Woo": ["김현우"],
  "Kim Jang-Hoon": ["김장훈"],
  "Kim Ji-soo": ["JISOO"],
  "Kim Jung Mi": ["김정미"],
  "Kim Kyung Ho": ["김경호"],
  "Kim Minwoo": ["김민우"],
  "Kim SangMin": ["김상민"],
  "Kim Soo Cheol": ["김수철"],
  "KIM sung myun": ["김성면"],
  "Kim Tae Hwa": ["김태화"],
  "Kim Tae Hyun": ["김태현"],
  "Kim Won Jun": ["김원준"],
  "KIRARA": ["키라라"],
  "Knave": ["네이브"],
  "Kriz": ["송시진", "크리즈"],
  "Kuhmo Asiana String Quartet": ["Asiana"],
  "KUSH": ["김병훈"],
  "KYT-METAL": ["KYT"],
  "KYUNGHO BANG": ["방경호"],
  "Kyunghwa Jung": ["정경화"],
  "Lamb of God": ["god"],
  "Lang Lee": ["이랑"],
  "Leaves Black": ["리브스 블랙"],
  "Lee Duke Jean": ["이덕진"],
  "LEE HYUN SUK PROJECT": ["이현석 프로젝트"],
  "Lee Hyun Suk;KIM sung myun": ["Lee Hyun Suk"],
  "Lee Jeong Seon": ["이정선"],
  "Lee Ji Hoon": ["이지훈"],
  "Lee Ji Hyung": ["이지형"],
  "Lee Mu-jin": ["이무진"],
  "Lee Sang Eun": ["이상은"],
  "Lee Sang Woo": ["이상우"],
  "Lee Yerin": ["이예린"],
  "LEEHEESANG": ["이희상"],
  "Life and Time": ["라이프 앤 타임"],
  "LILY": ["릴리"],
  "Linkin Park": ["박진영"],
  "Linus’ Blanket": ["라이너스의 담요"],
  "Linus' Blanket;Billy Acoustie": ["Linus' Blanket"],
  "Little Giant Drug": ["Little Giant"],
  "Locust": ["LOCUST"],
  "Loro's": ["로로스"],
  "LOVE & PEACE": ["Love and Peace"],
  "Loveholics": ["러브홀릭"],
  "Lucid Fall": ["루시드폴"],
  "Lucy": ["LUCY"],
  "Luminous Transfixion": ["TransFixion"],
  "Lustrouble": ["러스트러블"],
  "Lyn": ["이세진"],
  "Magma": ["마그마"],
  "Maïmon and The Mongoose Band": ["The Mongoose"],
  "Mei Ehara": ["mei ehara"],
  "metro trip": ["메트로 트립"],
  "Mid-Air Thief": ["공중도둑"],
  "Min Hae Kyung": ["민해경"],
  "Mingginyu": ["Mingginyu (밍기뉴)", "밍기뉴"],
  "MINNIE": ["민니"],
  "Minuano": ["미누아노"],
  "MIRAE": ["윤미래"],
  "Moonlight Fairy Reversal Grand Slam": ["달빛요정역전만루홈런"],
  "MORRIE": ["Morrie"],
  "MOT": ["못"],
  "Mr Miss": ["미스터미스"],
  "Mr.2": ["MR.2"],
  "Nastyona": ["NASTYONA"],
  "NCT 127": ["엔시티"],
  "NCT DREAM": ["엔시티드림"],
  "NELL": ["넬"],
  "Nerd Connection": ["너드 커넥션", "너드커넥션"],
  "NewJeans": ["뉴진스", "엔제이지"],
  "NMIXX": ["엔믹스"],
  "No Sa Yeon": ["노사연"],
  "Noizegarden": ["노이즈가든"],
  "NOVADOX": ["노바독스"],
  "Novasonic": ["노바소닉"],
  "NRG": ["엔알지"],
  "Om Ha Jin": ["Ha Jin"],
  "oomool": ["오무울"],
  "OOO": ["O.O.O"],
  "OWALLOIL": ["오왈로일"],
  "Panic": ["패닉"],
  "Parannoul": ["파란노을"],
  "Park Hye Kyung": ["박혜경"],
  "Park Jang Hyeon": ["Jang Hyeon"],
  "Park Jungwoon": ["박정운"],
  "Park, Hongjun": ["TEDDY"],
  "Pdogg": ["강효원", "피독"],
  "pH-1": ["피에이치원", "朴俊元", "박준원"],
  "Phonebooth": ["폰부스"],
  "Pinocchio": ["피노키오"],
  "Pippi's Band": ["Pippi Band"],
  "pitcher56": ["Pitcher56"],
  "PLAVE": ["플레이브"],
  "Postino": ["이준호", "포스티노"],
  "Primary": ["프라이머리"],
  "Puleunsaebyeog": ["푸른새벽"],
  "QWER": ["최애의 아이들"],
  "R.ef": ["알이에프"],
  "R.I.O.": ["RIO"],
  "Raoul N. di Seimbote": ["n@di"],
  "Red Hot Chili Peppers": ["H.O.T."],
  "Red Velvet": ["레드벨벳"],
  "Redoor": ["레도어"],
  "RM": ["김남준", "알엠"],
  "Robert Baksa": ["이박사"],
  "Rock 'n' Roll Radio": ["Rock N Roll Radio"],
  "ROCK-TA PROJECT BAND": ["록타 프로젝트 밴드"],
  "Rollercoaster": ["롤러코스터"],
  "RoRo": ["한로로"],
  "ROSÉ": ["로제", "박채영"],
  "ROUND TABLE": ["라운드 테이블"],
  "rourourourous": ["루루루러스"],
  "Runway": ["런웨이"],
  "Ryu JiHo": ["류지호"],
  "S.E.S.": ["에스이에스"],
  "Sang": ["윤상"],
  "Satellite Lovers": ["새틀라이트 러버즈"],
  "Sawol": ["김사월"],
  "SE SO NEON": ["새소년"],
  "Seo Ji Won": ["서지원"],
  "SEVENTEEN": ["세븐틴"],
  "SF9": ["에스에프나인"],
  "Shim Shin": ["심신"],
  "Shin Hyobum": ["신효범"],
  "Shin In Ryu": ["신인류"],
  "Shin Joong Hyun And Musicpower": ["신중현과 뮤직파워"],
  "SHINee": ["샤이니"],
  "Silica Gel": ["실리카겔"],
  "Sinchon Blues": ["신촌블루스"],
  "SION": ["Sion"],
  "Sky": ["SKY"],
  "So!YoON!;Phum Viphurit": ["So!YoON!"],
  "Sole": ["SOLE"],
  "Songolmae": ["송골매"],
  "SOOJIN": ["서수진", "수진"],
  "Soombee": ["숨비"],
  "Soumbalgwang": ["소음발광"],
  "SS501": ["SS501", "더블에스오공일"],
  "Stereo Venus;Rumer": ["스테레오 비너스"],
  "Stray Kids": ["스트레이 키즈"],
  "SUGA": ["민윤기", "슈가", "Agust D"],
  "Sultan of the Disco": ["술탄 오브 더 디스코"],
  "SUNNY": ["써니", "이순규"],
  "SUPER JUNIOR": ["슈퍼주니어"],
  "SURL": ["설"],
  "Switcbak": ["스위치백"],
  "TAE JIN AH": ["태진아"],
  "TAEYANG": ["동영배", "태양"],
  "TAEYEON": ["김태연", "태연"],
  "TAIJI": ["서태지"],
  "TEDDY": ["Park, Hongjun", "Teddy Park", "박테디", "박홍준"],
  "Teddy Park": ["TEDDY"],
  "Terry Pratchett": ["Terry"],
  "The Black Skirts": ["검정치마"],
  "The Blue Sky Boys": ["Blue Sky"],
  "The Breeze": ["더 브리즈"],
  "The Cross": ["더 크로스"],
  "The Garden": ["카더가든"],
  "The Green Tea": ["더 그린티"],
  "The Jadu": ["자두"],
  "The Marshmallow Kisses": ["더 마쉬멜로우 키세스"],
  "The MD": ["더 MD"],
  "The Monotones": ["더 모노톤즈"],
  "The Poles": ["더 폴스", "더 폴즈"],
  "The Quiett": ["더콰이엇"],
  "The Rolling Stones": ["김뜻돌"],
  "The Rose": ["더 로즈"],
  "The Toy Dolls": ["토이"],
  "The Volunteers": ["더 볼런티어스"],
  "Thornapple": ["쏜애플"],
  "Three Strangers": ["세명의 이방인"],
  "through the sloe": ["through the sloe"],
  "Tiffany Young": ["스테파니 황", "티파니", "황미영"],
  "Tiger JK": ["서정권"],
  "Toy;Lee Ji Hyung": ["Toy"],
  "TRPP": ["티알피피"],
  "Tuesday Beach Club": ["화요비치클럽"],
  "TWICE": ["트와이스"],
  "TwoTwo": ["투투"],
  "UN": ["Un"],
  "Underwears Band": ["언더웨어즈"],
  "Untitle": ["언타이틀"],
  "V": ["김태형", "뷔"],
  "Vacation": ["가을방학"],
  "Baek A": ["백아"],
  "Various Artists": ["여러 아티스트"],
  "WINNER": ["위너"],
  "Woodie Gochild": ["우디 고차일드"],
  "WOODZ": ["조승연"],
  "Xdinary Heroes": ["엑스디너리 히어로즈"],
  "Xydo": ["박치웅", "시도"],
  "Y2K": ["와이투케이"],
  "Yangbans": ["양반들"],
  "Yangpa": ["양파"],
  "Yarn": ["얀"],
  "YB": ["윤도현밴드"],
  "Yellow Monsters": ["옐로 몬스터즈"],
  "YEONJUN": ["연준"],
  "YEREMY": ["예레미"],
  "Yes": ["yes"],
  "yes, mama ok?": ["mama ok?"],
  "Yoo Young Sun & The Connexion;Yoo Young Sun": ["Yoo Young Sun & The Connexion"],
  "You Too": ["브로콜리너마저"],
  "youra": ["유라"],
  "YTC": ["와이티씨"],
  "YURI": ["권유리", "유리"],
  "Zam": ["잠"],
  "ZaZa": ["Zaza"],
  "ZICO": ["지코"],
  "Zion.T": ["자이언티"],
  "ZOO": ["Zoo"],
  "ZoPD": ["조PD"],
  "(여자)아이들": ["i‐dle"],
  "강효원": ["Pdogg"],
  "갤럭시 익스프레스": ["Galaxy Express"],
  "검정치마": ["The Black Skirts", "black skirt", "조휴일", "검정치마"],
  "고윤하": ["윤하"],
  "골든": ["GSoul"],
  "곰팡이": ["이성훈"],
  "공일오비": ["015B"],
  "공중도둑": ["Mid-Air Thief"],
  "구남": ["구남과여라이딩스텔라"],
  "구남과여라이딩스텔라": ["구남"],
  "국카스텐": ["Guckkasten"],
  "권유리": ["YURI"],
  "권지용": ["G‐Dragon"],
  "규현": ["조규현"],
  "글렌체크": ["Glen Check"],
  "김경호": ["Kim Kyung Ho"],
  "김광석": ["김광석"],
  "김남준": ["RM"],
  "김민영": ["타루"],
  "김민지": ["민지"],
  "김병훈": ["KUSH"],
  "김샛별": ["샛별"],
  "김성혜": ["도원경"],
  "김수철": ["Kim Soo Cheol"],
  "김승민": ["승민"],
  "김원준": ["Kim Won Jun"],
  "김장훈": ["Kim Jang-Hoon"],
  "김정미": ["Kim Jung Mi"],
  "김제니": ["JENNIE"],
  "김지수": ["JISOO"],
  "김지우": ["지우"],
  "김지원": ["리즈"],
  "김지환": ["And"],
  "김춘추": ["놀이도감"],
  "김태연": ["TAEYEON"],
  "김태형": ["V"],
  "김현정": ["Kim Hyun Jung"],
  "김휘동": ["Bronze"],
  "나잠 수": ["나잠수", "나진수", "압둘라 나잠"],
  "나잠수": ["나잠 수"],
  "나진수": ["나잠 수"],
  "너드 커넥션": ["Nerd Connection"],
  "너드커넥션": ["Nerd Connection"],
  "넬": ["NELL"],
  "노래를 찾는 사람들": ["노찾사"],
  "노사연": ["No Sa Yeon"],
  "노찾사": ["노래를 찾는 사람들"],
  "놀이도감": ["김춘추"],
  "뉴진스": ["NewJeans"],
  "다브다": ["다브다"],
  "다이나믹 듀오": ["Dynamic Duo"],
  "다이나믹듀오": ["Dynamic Duo"],
  "달빛요정역전만루홈런": ["Moonlight Fairy"],
  "더 로즈": ["The Rose"],
  "더 크로스": ["The Cross"],
  "더 폴스": ["The Poles"],
  "더블에스오공일": ["SS501"],
  "더콰이엇": ["The Quiett"],
  "던밀스": ["Don Mills"],
  "델리스파이스": ["DELISPICE", "Deli Spice"],
  "도시": ["dosii"],
  "도원경": ["김성혜"],
  "동방신기": ["TVXQ"],
  "동영배": ["TAEYANG"],
  "됸쥬": ["됸쥬"],
  "딘": ["Dean"],
  "라이프 앤 타임": ["Life and Time"],
  "러브홀릭": ["Loveholics"],
  "레드벨벳": ["Red Velvet"],
  "레이디 제인": ["전지혜"],
  "로로스": ["Loro's"],
  "로제": ["ROSÉ"],
  "롤러코스터": ["Rollercoaster"],
  "루시드폴": ["Lucid Fall"],
  "르세라핌": ["LE SSERAFIM"],
  "리노": ["이민호"],
  "리즈": ["김지원", "리즈"],
  "릴리": ["LILY"],
  "마마무": ["MAMAMOO"],
  "민니": ["MINNIE"],
  "민지": ["김민지", "민지"],
  "민해경": ["Min Hae Kyung"],
  "밍기뉴": ["Mingginyu"],
  "박명은": ["진"],
  "박재범": ["Jay Park"],
  "박정우": ["정우"],
  "박준원": ["pH-1"],
  "박채영": ["ROSÉ"],
  "박치웅": ["Xydo"],
  "박테디": ["TEDDY"],
  "박혜경": ["Park Hye Kyung"],
  "박홍준": ["TEDDY"],
  "방탄소년단": ["BTS"],
  "백아": ["Baek A"],
  "백지영": ["백지영"],
  "버스커 버스커": ["버스커 버스커"],
  "보라미유": ["장보람"],
  "보수동쿨러": ["Bosudongcooler"],
  "보아": ["BoA"],
  "볼빨간사춘기": ["볼빨간사춘기"],
  "브로큰 발렌타인": ["Broken Valentine"],
  "브론즈": ["Bronze"],
  "브루노 마스": ["Bruno Mars"],
  "블랙핑크": ["BLACKPINK"],
  "비": ["Rain"],
  "비투비": ["BTOB"],
  "비투비 포유": ["BTOB 4U"],
  "빅뱅": ["BIGBANG"],
  "새소년": ["SE SO NEON"],
  "샛별": ["김샛별"],
  "샤이니": ["SHINee"],
  "서수진": ["SOOJIN"],
  "서정권": ["Tiger JK"],
  "선미": ["SUNMI"],
  "소녀시대": ["Girls Generation", "SNSD", "Girls’ Generation"],
  "소연": ["JEON SOYEON"],
  "송골매": ["Songolmae"],
  "송시진": ["Kriz"],
  "수진": ["SOOJIN"],
  "술탄 오브 더 디스코": ["Sultan of the Disco"],
  "슈퍼주니어": ["SUPER JUNIOR"],
  "스테파니 황": ["Tiffany Young"],
  "스트레이 키즈": ["Stray Kids", "SKZ"],
  "승리": ["승리", "이승현"],
  "승민": ["김승민"],
  "시도": ["Xydo"],
  "신동륜": ["신성우"],
  "신성우": ["신동륜"],
  "신승훈": ["신승훈"],
  "신인류": ["Shin In Ryu"],
  "신중현과 뮤직파워": ["Shin Joong Hyun"],
  "신효범": ["Shin Hyobum"],
  "실리카겔": ["Silica Gel"],
  "싸이": ["Psy"],
  "써니": ["SUNNY"],
  "씨엔블루": ["CNBLUE"],
  "씨잼": ["C Jamm"],
  "아이들": ["i‐dle"],
  "아이유": ["IU", "이지은"],
  "악동뮤지션": ["AKMU", "악뮤"],
  "악뮤": ["AKMU"],
  "안재욱": ["An Jaewook"],
  "압둘라 나잠": ["나잠 수"],
  "앤드": ["And"],
  "양수경": ["양수경"],
  "양파": ["Yangpa"],
  "에스에프나인": ["SF9"],
  "에스파": ["aespa"],
  "에이오에이": ["AOA"],
  "에프엑스": ["f(x)"],
  "에픽하이": ["Epik High"],
  "엑소": ["EXO"],
  "엑스디너리 히어로즈": ["Xdinary Heroes"],
  "엔알지": ["NRG"],
  "엔제이지": ["NewJeans"],
  "여러 아티스트": ["Various Artists"],
  "여자아이들": ["(G)I-DLE", "GIDLE"],
  "연준": ["YEONJUN"],
  "오해원": ["해원"],
  "와인": ["장수빈"],
  "우디 고차일드": ["Woodie Gochild"],
  "원정호": ["BreadBeat"],
  "위너": ["WINNER"],
  "유라": ["youra"],
  "유리": ["YURI"],
  "유제이": ["이윤주"],
  "윤도현밴드": ["YB", "윤도현"],
  "윤하": ["고윤하", "윤하"],
  "이근수": ["Keeproots"],
  "이랑": ["Lang Lee"],
  "이무진": ["Lee Mu-jin"],
  "이민혁": ["이민혁", "허타"],
  "이민호": ["리노"],
  "이상은": ["Lee Sang Eun"],
  "이성훈": ["곰팡이"],
  "이세진": ["Lyn"],
  "이센스": ["E SENS", "강민호"],
  "이수영": ["이수영", "이지연"],
  "이순규": ["SUNNY"],
  "이승현": ["승리"],
  "이용복": ["필릭스"],
  "이윤주": ["유제이"],
  "이정선": ["Lee Jeong Seon"],
  "이준호": ["Postino"],
  "이지연": ["이수영"],
  "이지은": ["IU"],
  "이지형": ["Lee Ji Hyung"],
  "이지훈": ["Lee Ji Hoon"],
  "이찬혁": ["이찬혁"],
  "이효리": ["Lee Hyori"],
  "일리스트 컨퓨젼": ["Illest Konfusion"],
  "임재범": ["任載範"],
  "있지": ["ITZY"],
  "자이언티": ["Zion.T"],
  "잔나비": ["잔나비"],
  "장기하와 얼굴들": ["장기하와 얼굴들"],
  "장다혜": ["Heize"],
  "장보람": ["보라미유"],
  "장수빈": ["와인", "장수빈"],
  "적재": ["정재원"],
  "전인권": ["In Kwon Jeon"],
  "전재희": ["전재희"],
  "전지혜": ["레이디 제인"],
  "정밀아": ["JEONGMILLA"],
  "정용화": ["정용화"],
  "정우": ["박정우"],
  "정은지": ["정혜림"],
  "정재원": ["적재"],
  "정혜림": ["정은지"],
  "정호석": ["j‐hope"],
  "제니": ["JENNIE"],
  "조규현": ["규현"],
  "조상연": ["조조"],
  "조승연": ["WOODZ"],
  "조조": ["조상연"],
  "조PD": ["ZoPD"],
  "지니": ["JINI"],
  "지드래곤": ["G-DRAGON", "GD", "권지용", "gdragon"],
  "지수": ["JISOO"],
  "지우": ["김지우", "지우"],
  "지코": ["ZICO", "우지호"],
  "진": ["박명은"],
  "청하": ["Chungha"],
  "최애의 아이들": ["QWER"],
  "최영경": ["최영경"],
  "최윤진": ["JINI"],
  "최재훈": ["Choi Jae Hoon"],
  "코토바": ["cotoba"],
  "크러쉬": ["Crush"],
  "크리즈": ["Kriz"],
  "클론": ["Clon"],
  "키라라": ["KIRARA"],
  "킵루츠": ["Keeproots"],
  "타루": ["김민영"],
  "태양": ["TAEYANG"],
  "태연": ["TAEYEON", "김태연"],
  "태진아": ["TAE JIN AH"],
  "투애니원": ["2NE1"],
  "투피엠": ["2PM"],
  "트와이스": ["TWICE"],
  "티파니": ["Tiffany Young"],
  "파란노을": ["Parannoul"],
  "패닉": ["Panic"],
  "포스티노": ["Postino"],
  "폰부스": ["Phonebooth"],
  "푸른새벽": ["Puleunsaebyeog"],
  "프라이머리": ["Primary"],
  "플레이브": ["PLAVE"],
  "피독": ["Pdogg"],
  "필릭스": ["이용복"],
  "한": ["한지성"],
  "한로로": ["HANRORO"],
  "한지성": ["한"],
  "해원": ["오해원", "해원"],
  "해파리": ["HAEPAARY"],
  "허타": ["이민혁"],
  "헤이즈": ["Heize"],
  "혁오": ["혁오"],
  "현아": ["HyunA"],
  "현진": ["황현진"],
  "현진영": ["HYUN JIN YOUNG"],
  "황미영": ["Tiffany Young"],
  "황현진": ["현진"],
  "DJ 펌킨": ["DJ Pumkin"],
  "Mingginyu (밍기뉴)": ["Mingginyu"],
};

// 분당 최대 5회 throttle (Spotify 검색 API 보호)
const THROTTLE_MAX = 5;
const THROTTLE_WINDOW_MS = 60_000;
const callTimestamps: number[] = [];

function isThrottled(): boolean {
  const now = Date.now();
  while (callTimestamps.length && callTimestamps[0] < now - THROTTLE_WINDOW_MS) {
    callTimestamps.shift();
  }
  return callTimestamps.length >= THROTTLE_MAX;
}
function recordCall() { callTimestamps.push(Date.now()); }

interface Props {
  onSelect?: (spotifyId: string) => void;
  /** 듀얼 관계 탐색: A↔B 경로 요청 */
  onDualSelect?: (idA: string, idB: string) => void;
}

// ── 미니 단일 아티스트 검색 서브컴포넌트 (듀얼 탭에서 재사용) ──────────
function MiniSearch({
  label,
  selected,
  localIndex,
  onSelect,
  onClear,
}: {
  label: string;
  selected: SearchEntry | null;
  localIndex: SearchEntry[];
  onSelect: (e: SearchEntry) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchEntry[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  const search = useCallback((val: string) => {
    setQ(val);
    if (!val.trim()) { setHits([]); return; }
    const tok = val.toLowerCase().replace(/\s+/g, "");
    setHits(
      localIndex
        .filter(a => a.searchTokens.some(t => t.includes(tok)) || a.spotifyId.includes(tok))
        .slice(0, 5)
    );
  }, [localIndex]);

  if (selected) {
    return (
      <div
        onClick={onClear}
        title="클릭해서 다른 아티스트 검색"
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
          background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 12, cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.14)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.08)")}
      >
        {selected.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.imageUrl} alt={selected.name}
            width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "rgba(167,139,250,0.6)", marginBottom: 1 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{selected.name}</div>
        </div>
        {/* 수정 힌트 아이콘 */}
        <span style={{ fontSize: 11, color: "rgba(167,139,250,0.45)", userSelect: "none" }}>✏️</span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", marginBottom: 5, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <input
        ref={ref}
        value={q}
        onChange={e => search(e.target.value)}
        placeholder="아티스트 이름 검색..."
        autoComplete="off"
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "9px 12px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: 10, fontSize: 13, color: "#fff", outline: "none",
        }}
      />
      {hits.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
          marginTop: 4, background: "rgba(7,9,20,0.97)",
          border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10,
          overflow: "hidden",
        }}>
          {hits.map(h => (
            <button key={h.spotifyId} onClick={() => { onSelect(h); setQ(""); setHits([]); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", color: "#fff",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {h.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={h.imageUrl} alt={h.name} width={24} height={24}
                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 24, height: 24, borderRadius: "50%",
                    background: "rgba(167,139,250,0.15)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "var(--accent-core)" }}>{h.name.charAt(0)}</div>
              }
              <span style={{ fontSize: 13 }}>{h.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function FloatingSearch({ onSelect, onDualSelect }: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"single" | "dual">("single");

  // 단일 검색 상태
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [throttleMsg, setThrottleMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 듀얼 검색 상태
  const [dualA, setDualA] = useState<SearchEntry | null>(null);
  const [dualB, setDualB] = useState<SearchEntry | null>(null);

  // 로컬 인덱스
  const [localIndex, setLocalIndex] = useState<SearchEntry[]>([]);

  // v5-layout + v5-details 머지
  useEffect(() => {
    Promise.all([
      fetch("/data/v5-layout.json").then(r => r.json()),
      fetch("/data/v5-details.json").then(r => r.json()),
    ])
      .then(([layoutData, detailsData]) => {
        const arr = Object.values(layoutData.nodes).map((n: any) => {
          const primaryName = n.nameKo || n.name;
          const aliases = ALIAS_MAP[n.name] || ALIAS_MAP[primaryName] || [];
          return {
            spotifyId: n.id,
            name: primaryName,
            searchTokens: [n.name, n.nameKo, ...aliases]
              .filter(Boolean)
              .map((t: string) => t.toLowerCase().replace(/\s+/g, "")),
            imageUrl: detailsData[n.id]?.image || null,
            genres: detailsData[n.id]?.genres || [],
          };
        });
        setLocalIndex(arr);
      })
      .catch(() => {});
  }, []);

  // 패널 열릴 때 포커스
  useEffect(() => {
    if (open && activeTab === "single") setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, activeTab]);

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 단일 검색
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setThrottleMsg("");
    if (!value.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      const q = value.toLowerCase().replace(/\s+/g, "");
      const local = localIndex
        .filter(a => a.searchTokens.some(t => t.includes(q)) || a.spotifyId.toLowerCase().includes(q))
        .slice(0, 8);
      setResults(local);

      if (local.length < 3) {
        if (isThrottled()) { setThrottleMsg("잠시 후 다시 시도해주세요 (검색 횟수 제한)"); return; }
        setIsSearching(true);
        try {
          recordCall();
          const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(value)}`);
          if (res.ok) {
            const remote: SearchEntry[] = await res.json();
            const localIds = new Set(local.map(a => a.spotifyId));
            setResults([...local, ...remote.filter(a => !localIds.has(a.spotifyId))].slice(0, 8));
          }
        } catch { /* 조용히 처리 */ } finally { setIsSearching(false); }
      }
    }, 320);
  }, [localIndex]);

  const handleSelect = useCallback(async (spotifyId: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (onSelect) { onSelect(spotifyId); return; }
    try {
      const check = await fetch(`/data/hub/${spotifyId}.json`, { method: "HEAD" });
      if (check.ok) { router.push(`/from/${spotifyId}`); return; }
    } catch { /* 없으면 from 페이지 */ }
    router.push(`/from/${spotifyId}`);
  }, [router, onSelect]);

  // 듀얼 관계 탐색 확정
  const handleDualSearch = useCallback(() => {
    if (!dualA || !dualB || !onDualSelect) return;
    onDualSelect(dualA.spotifyId, dualB.spotifyId);
    setOpen(false);
  }, [dualA, dualB, onDualSelect]);

  return (
    <>
      {/* ── 플로팅 검색 버튼 ─────────────────────────── */}
      <button
        id="floating-search-btn"
        aria-label="아티스트 검색"
        onClick={() => setOpen(v => !v)}
        style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 16px)", left: 16, zIndex: 200,
          width: 42, height: 42, borderRadius: "50%",
          background: open ? "rgba(167,139,250,0.25)" : "rgba(10,14,26,0.7)",
          border: `1px solid ${open ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(12px)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.25s ease",
          boxShadow: open ? "0 0 16px rgba(167,139,250,0.3)" : "none",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.9)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(200,190,255,0.8)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </button>

      {/* ── 검색 패널 ─────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 190,
        transform: open ? "translateY(0)" : "translateY(-110%)",
        opacity: open ? 1 : 0,
        transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease",
        background: "rgba(7,9,18,0.96)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(167,139,250,0.15)",
        padding: "calc(env(safe-area-inset-top, 0px) + 68px) 16px 20px",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>

          {/* 탭 선택 */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 3 }}>
            {([
              { key: "single", icon: "🔍", label: "아티스트 탐색" },
              { key: "dual",   icon: "🚀", label: "관계 유영" },
            ] as const).map(tab => (
              <button
                key={tab.key}
                id={`search-tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, padding: "7px 12px", borderRadius: 9, border: "none",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.2s",
                  background: activeTab === tab.key
                    ? "rgba(167,139,250,0.18)"
                    : "transparent",
                  color: activeTab === tab.key
                    ? "#c084fc"
                    : "rgba(255,255,255,0.4)",
                  borderBottom: activeTab === tab.key
                    ? "2px solid #c084fc"
                    : "2px solid transparent",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── 탭 1: 단일 검색 ── */}
          {activeTab === "single" && (<>
            <div style={{ position: "relative" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="rgba(167,139,250,0.5)" strokeWidth="2" strokeLinecap="round"
                style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                id="search-input"
                type="search"
                value={query}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && results.length > 0) {
                    e.preventDefault();
                    handleSelect(results[0].spotifyId);
                  }
                }}
                placeholder="아티스트 검색... (BTS, 아이유, 혁오...)"
                autoComplete="off"
                className="search-input"
                style={{ width: "100%", padding: "12px 16px 12px 40px", fontSize: 15, boxSizing: "border-box" }}
              />
              {isSearching && (
                <div style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  width: 16, height: 16, border: "2px solid var(--accent-core)",
                  borderTop: "2px solid transparent", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
              )}
            </div>

            {throttleMsg && <p style={{ textAlign: "center", fontSize: 12, color: "#fb923c", marginTop: 8 }}>⚠️ {throttleMsg}</p>}

            {results.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
                {results.map(artist => (
                  <button key={artist.spotifyId} onClick={() => handleSelect(artist.spotifyId)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", background: "rgba(167,139,250,0.04)",
                      border: "none", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
                  >
                    {artist.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artist.imageUrl} alt={artist.name} width={36} height={36}
                        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%",
                        background: "rgba(167,139,250,0.15)", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, color: "var(--accent-core)", }}>
                        {artist.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{artist.name}</div>
                      {artist.genres?.length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {artist.genres.slice(0, 2).join(" · ")}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(167,139,250,0.5)" }}>→</span>
                  </button>
                ))}
              </div>
            )}

            {query.trim() && !isSearching && results.length === 0 && (
              <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 16 }}>
                &ldquo;{query}&rdquo; 검색 결과가 없습니다
              </p>
            )}
          </>)}

          {/* ── 탭 2: 관계 유영 ── */}
          {activeTab === "dual" && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <MiniSearch
                  label="출발"
                  selected={dualA}
                  localIndex={localIndex}
                  onSelect={setDualA}
                  onClear={() => setDualA(null)}
                />

                <MiniSearch
                  label="도착"
                  selected={dualB}
                  localIndex={localIndex}
                  onSelect={setDualB}
                  onClear={() => setDualB(null)}
                />
              </div>

              {/* 유영 시작 버튼 */}
              <button
                id="dual-search-go-btn"
                onClick={handleDualSearch}
                disabled={!dualA || !dualB}
                style={{
                  marginTop: 14, width: "100%", padding: "12px",
                  borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700,
                  background: dualA && dualB
                    ? "linear-gradient(135deg, #a78bfa, #c084fc)"
                    : "rgba(255,255,255,0.06)",
                  color: dualA && dualB ? "#fff" : "rgba(255,255,255,0.25)",
                  cursor: dualA && dualB ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                }}
              >
                {dualA && dualB
                  ? `🚀 ${dualA.name} → ${dualB.name} 유영 시작`
                  : "아티스트 두 명을 선택하세요"}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 배경 클릭으로 닫기 */}
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 180, background: "transparent" }} />
      )}

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </>
  );
}
