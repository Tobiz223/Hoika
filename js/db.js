// Статические данные игры. Состояние партии — в G (см. world.js).
const DB = {};
DB.IDEO = { dem:{n:'Демократия',c:'#4f8fd6'}, fas:{n:'Фашизм',c:'#7a5230'}, com:{n:'Коммунизм',c:'#c8352b'}, neu:{n:'Нейтралитет',c:'#8c8c7a'} };
DB.RES = { oil:'Нефть', steel:'Сталь', alu:'Алюминий', rub:'Резина', tun:'Вольфрам', chr:'Хром' };

DB.COUNTRIES = [
 {t:'GER',n:'Германия',c:'#59616b',i:'fas',l:'А. Гитлер',cap:'Berlin',pop:66,civ:32,mil:26,dock:6,infra:5,st:.7,w:.45,major:1,divs:{inf:30,mtn:2,cav:1},pl:{ftr:280,cas:60,tac:90},sh:{dd:8,cl:5,ca:2,bb:2,ss:12},party:{fas:.82,neu:.1,dem:.05,com:.03}},
 {t:'ITA',n:'Италия',c:'#5e9c5a',i:'fas',l:'Б. Муссолини',cap:'Rome',pop:43,civ:14,mil:12,dock:6,infra:4,st:.65,w:.4,major:1,divs:{inf:30,mtn:4,mot:2},pl:{ftr:220,cas:40,tac:100},sh:{dd:30,cl:12,ca:7,bb:4,ss:30},col:{rub:2,oil:2,alu:2},party:{fas:.7,neu:.2,dem:.07,com:.03}},
 {t:'ENG',n:'Великобритания',c:'#b84a4a',i:'dem',l:'С. Болдуин',cap:'London',pop:47,civ:36,mil:14,dock:14,infra:5,st:.75,w:.2,major:1,divs:{inf:18,mot:1},pl:{ftr:320,tac:120,str:40,nav:60},sh:{dd:70,cl:40,ca:15,bb:15,cv:6,ss:20},col:{oil:30,rub:40,alu:14,steel:20,chr:8,tun:8},mpc:1.6,party:{dem:.88,fas:.04,com:.03,neu:.05}},
 {t:'FRA',n:'Франция',c:'#3f6fc2',i:'dem',l:'А. Сарро',cap:'Paris',pop:41,civ:30,mil:16,dock:6,infra:5,st:.5,w:.2,major:1,divs:{inf:38,mtn:3,cav:3,mot:1},pl:{ftr:240,tac:100,nav:20},sh:{dd:32,cl:12,ca:7,bb:6,cv:1,ss:40},col:{rub:12,oil:6,alu:4,steel:8,chr:2},mpc:1.3,party:{dem:.7,neu:.15,com:.1,fas:.05}},
 {t:'SOV',n:'СССР',c:'#a33b36',i:'com',l:'И. Сталин',cap:'Moscow',pop:165,civ:38,mil:34,dock:4,infra:3,st:.45,w:.3,major:1,divs:{inf:70,cav:8,mtn:4},pl:{ftr:600,tac:300,cas:80},sh:{dd:16,cl:4,bb:3,ss:30},party:{com:.95,neu:.03,fas:.01,dem:.01}},
 {t:'POL',n:'Польша',c:'#c76a7a',i:'neu',l:'И. Мосцицкий',cap:'Warsaw',pop:34,civ:10,mil:6,dock:1,infra:3,st:.55,w:.45,divs:{inf:30,cav:6},pl:{ftr:120,tac:30},sh:{dd:4,ss:3},party:{neu:.7,dem:.2,fas:.05,com:.05}},
 {t:'CZE',n:'Чехословакия',c:'#6ba5a0',i:'dem',l:'Э. Бенеш',cap:'Prague',pop:15,civ:8,mil:7,dock:0,infra:4,st:.6,w:.3,divs:{inf:18,mtn:2},pl:{ftr:90,tac:30},party:{dem:.75,neu:.15,fas:.05,com:.05}},
 {t:'AUS',n:'Австрия',c:'#d6cfc0',i:'neu',l:'В. Миклас',cap:'Vienna',pop:7,civ:3,mil:2,dock:0,infra:4,st:.45,w:.1,divs:{inf:6,mtn:2},pl:{ftr:24},party:{neu:.6,fas:.25,dem:.1,com:.05}},
 {t:'HUN',n:'Венгрия',c:'#b58a4c',i:'neu',l:'М. Хорти',cap:'Budapest',pop:9,civ:4,mil:2,dock:0,infra:3,st:.5,w:.25,divs:{inf:7,cav:1},pl:{ftr:24},party:{neu:.6,fas:.3,dem:.08,com:.02}},
 {t:'ROM',n:'Румыния',c:'#c9b84a',i:'neu',l:'Кароль II',cap:'Bucharest',pop:19,civ:6,mil:3,dock:1,infra:2,st:.5,w:.2,divs:{inf:18,mtn:2,cav:2},pl:{ftr:60},sh:{dd:4},party:{neu:.65,fas:.2,dem:.13,com:.02}},
 {t:'YUG',n:'Югославия',c:'#7f9ec4',i:'neu',l:'Павел',cap:'Belgrade',pop:15,civ:4,mil:2,dock:1,infra:2,st:.4,w:.2,divs:{inf:18,mtn:3},pl:{ftr:50},sh:{dd:3,ss:2},party:{neu:.7,dem:.15,fas:.1,com:.05}},
 {t:'BUL',n:'Болгария',c:'#6f8f5f',i:'neu',l:'Борис III',cap:'Sofia',pop:6,civ:2,mil:1,dock:0,infra:2,st:.5,w:.3,divs:{inf:8},pl:{ftr:12},party:{neu:.7,fas:.2,dem:.05,com:.05}},
 {t:'GRE',n:'Греция',c:'#6fb4d6',i:'neu',l:'Георг II',cap:'Athens',pop:7,civ:3,mil:1,dock:1,infra:2,st:.5,w:.25,divs:{inf:9,mtn:2},pl:{ftr:30},sh:{dd:8,ss:4},party:{neu:.55,dem:.35,fas:.05,com:.05}},
 {t:'ALB',n:'Албания',c:'#a85a5a',i:'neu',l:'Зогу I',cap:'Tirana',pop:1,civ:0,mil:0,dock:0,infra:1,st:.4,w:.1,divs:{inf:2},party:{neu:.9,fas:.06,dem:.03,com:.01}},
 {t:'TUR',n:'Турция',c:'#8f9a68',i:'neu',l:'М. Кемаль',cap:'Ankara',pop:16,civ:5,mil:2,dock:1,infra:1,st:.6,w:.2,divs:{inf:18,cav:2},pl:{ftr:50},sh:{dd:4,bb:1,ss:4},party:{neu:.85,dem:.1,fas:.03,com:.02}},
 {t:'SPA',n:'Испания',c:'#c49450',i:'dem',l:'Н. Алькала-Самора',cap:'Madrid',pop:24,civ:9,mil:3,dock:2,infra:2,st:.25,w:.3,divs:{inf:14,mtn:2},pl:{ftr:50},sh:{dd:12,cl:4,bb:2,ss:6},party:{dem:.45,neu:.25,com:.2,fas:.1}},
 {t:'POR',n:'Португалия',c:'#6e8e4a',i:'neu',l:'А. Салазар',cap:'Lisbon',pop:7,civ:2,mil:1,dock:1,infra:2,st:.6,w:.1,divs:{inf:6},pl:{ftr:12},sh:{dd:4},col:{rub:4,oil:1},party:{neu:.85,fas:.08,dem:.05,com:.02}},
 {t:'BEL',n:'Бельгия',c:'#d4bd4e',i:'dem',l:'Леопольд III',cap:'Brussels',pop:8,civ:8,mil:4,dock:0,infra:5,st:.6,w:.15,divs:{inf:12},pl:{ftr:50},col:{rub:8,alu:2},party:{dem:.8,neu:.1,fas:.08,com:.02}},
 {t:'HOL',n:'Нидерланды',c:'#d88a3c',i:'dem',l:'Вильгельмина',cap:'Amsterdam',pop:8,civ:8,mil:3,dock:2,infra:5,st:.7,w:.1,divs:{inf:8},pl:{ftr:40},sh:{dd:6,cl:3,ss:8},col:{oil:18,rub:22,alu:6},party:{dem:.88,neu:.05,fas:.05,com:.02}},
 {t:'LUX',n:'Люксембург',c:'#88b0cc',i:'dem',l:'Шарлотта',cap:'Luxembourg',pop:.3,civ:1,mil:0,dock:0,infra:5,st:.7,w:.05,divs:{},party:{dem:.9,neu:.08,fas:.01,com:.01}},
 {t:'DEN',n:'Дания',c:'#c2606e',i:'dem',l:'Кристиан X',cap:'Copenhagen',pop:3.7,civ:3,mil:1,dock:1,infra:5,st:.7,w:.05,divs:{inf:3},pl:{ftr:12},sh:{dd:3},party:{dem:.9,neu:.05,fas:.03,com:.02}},
 {t:'NOR',n:'Норвегия',c:'#a95fa6',i:'dem',l:'Хокон VII',cap:'Oslo',pop:2.9,civ:2,mil:1,dock:1,infra:3,st:.7,w:.05,divs:{inf:4},pl:{ftr:12},sh:{dd:4},party:{dem:.9,neu:.05,fas:.03,com:.02}},
 {t:'SWE',n:'Швеция',c:'#4f7fb0',i:'dem',l:'Густав V',cap:'Stockholm',pop:6.3,civ:7,mil:3,dock:2,infra:4,st:.8,w:.1,divs:{inf:8},pl:{ftr:40},sh:{dd:6,cl:2,ss:6},party:{dem:.9,neu:.05,fas:.03,com:.02}},
 {t:'FIN',n:'Финляндия',c:'#c8d4d6',i:'dem',l:'П. Свинхувуд',cap:'Helsinki',pop:3.7,civ:2,mil:1,dock:0,infra:2,st:.7,w:.35,divs:{inf:9},pl:{ftr:24},party:{dem:.8,neu:.1,fas:.08,com:.02}},
 {t:'EST',n:'Эстония',c:'#6fa8a0',i:'neu',l:'К. Пятс',cap:'Tallinn',pop:1.1,civ:1,mil:0,dock:0,infra:3,st:.6,w:.15,divs:{inf:3},party:{neu:.8,dem:.15,fas:.03,com:.02}},
 {t:'LAT',n:'Латвия',c:'#a8605c',i:'neu',l:'К. Улманис',cap:'Riga',pop:1.9,civ:1,mil:0,dock:0,infra:3,st:.6,w:.15,divs:{inf:4},party:{neu:.8,dem:.15,fas:.03,com:.02}},
 {t:'LIT',n:'Литва',c:'#8fad58',i:'neu',l:'А. Сметона',cap:'Vilnius',cap2:'Kaunas',pop:2.3,civ:1,mil:0,dock:0,infra:3,st:.6,w:.15,divs:{inf:4},party:{neu:.8,dem:.12,fas:.05,com:.03}},
 {t:'SWI',n:'Швейцария',c:'#c75c58',i:'dem',l:'А. Мейер',cap:'Bern',pop:4.2,civ:4,mil:2,dock:0,infra:5,st:.9,w:.3,divs:{inf:9,mtn:3},pl:{ftr:24},party:{dem:.92,neu:.05,fas:.02,com:.01}},
 {t:'IRE',n:'Ирландия',c:'#6daa6a',i:'dem',l:'Э. де Валера',cap:'Dublin',pop:3,civ:2,mil:0,dock:0,infra:3,st:.6,w:.05,divs:{inf:2},party:{dem:.9,neu:.07,fas:.02,com:.01}},
 {t:'ICE',n:'Исландия',c:'#7da7c9',i:'dem',l:'Х. Йоунассон',cap:'Reykjavik',pop:.1,civ:0,mil:0,dock:0,infra:1,st:.8,w:.01,divs:{},party:{dem:.95,neu:.04,fas:.005,com:.005}},
];
// Страны, появляющиеся по ходу партии (гражданские войны и формируемые)
// Доля очков победы, потеря которых ведёт к капитуляции (база до поправок на стабильность и поддержку войны)
DB.SUR_LIMIT = { SOV:.95, GER:.9, ENG:.88, TUR:.85, FIN:.85, YUG:.8, GRE:.8, SWI:.85, POL:.75, ITA:.7, SPA:.75, NAT:.75, ROM:.7, HUN:.7, BUL:.7, SWE:.75, NOR:.75, FRA:.65, CZE:.65, AUS:.6, BEL:.6, HOL:.55, DEN:.5, LUX:.4, ALB:.6, POR:.7, IRE:.75, ICE:.5, EST:.6, LAT:.6, LIT:.6, EUR:.85, ROM2:.85 };
DB.EXTRA = {
 NAT:{t:'NAT',n:'Националистическая Испания',c:'#8f7a3a',i:'fas',l:'Ф. Франко',party:{fas:.75,neu:.15,dem:.08,com:.02}},
 EUR:{t:'EUR',n:'Европейский союз',c:'#2f4fa8',i:'dem',party:{dem:.85,neu:.1,com:.03,fas:.02}},
 ROM2:{t:'ROM2',n:'Римская империя',c:'#7b3f9e',i:'fas',party:{fas:.8,neu:.15,dem:.03,com:.02}},
};

// Снаряжение. cost — единиц промышленности на штуку. gens — качество поколений.
DB.EQ = {
 inf_eq:{n:'Стрелковое оружие',cost:.5,res:{steel:.12},gens:[1,1.18,1.35,1.5]},
 sup_eq:{n:'Снаряжение поддержки',cost:4,res:{alu:.06},gens:[1,1.3]},
 art_eq:{n:'Артиллерия',cost:3.5,res:{steel:.12,tun:.02},gens:[1,1.2,1.4]},
 at_eq:{n:'Противотанковые орудия',cost:4,res:{steel:.1,tun:.03},gens:[1,1.3,1.7]},
 aa_eq:{n:'Зенитные орудия',cost:4,res:{steel:.1,chr:.02},gens:[1,1.25,1.5]},
 rkt_eq:{n:'Реактивная артиллерия',cost:5,res:{steel:.1,chr:.03},gens:[1,1.3]},
 mot_eq:{n:'Грузовики',cost:2.5,res:{rub:.05,oil:.02},gens:[1]},
 mech_eq:{n:'Бронетранспортёры',cost:6,res:{steel:.12,rub:.04},gens:[1,1.3]},
 ltk_eq:{n:'Лёгкие танки',cost:8,res:{steel:.15,rub:.03},gens:[1,1.25,1.5]},
 mtk_eq:{n:'Средние танки',cost:12,res:{steel:.2,chr:.04,rub:.03},gens:[1,1.3,1.6]},
 htk_eq:{n:'Тяжёлые танки',cost:20,res:{steel:.3,chr:.08,tun:.03},gens:[1,1.3]},
 spg_eq:{n:'Самоходные орудия',cost:12,res:{steel:.2,tun:.03},gens:[1,1.3]},
 ftr:{n:'Истребители',cost:22,air:1,res:{alu:.3,rub:.05},gens:[1,1.3,1.6]},
 cas:{n:'Штурмовики',cost:24,air:1,res:{alu:.3,tun:.05},gens:[1,1.3,1.6]},
 tac:{n:'Тактические бомбардировщики',cost:38,air:1,res:{alu:.5,rub:.05},gens:[1,1.3,1.6]},
 str:{n:'Стратегические бомбардировщики',cost:70,air:1,res:{alu:.9,rub:.1},gens:[1,1.3,1.6]},
 nav:{n:'Морские бомбардировщики',cost:28,air:1,res:{alu:.3},gens:[1,1.3,1.6]},
};
DB.EQ_ORDER = Object.keys(DB.EQ);

// Боевые единицы конструктора. group определяет, что можно ставить в колонку.
const B = (id,n,group,eq,o) => [id,Object.assign({id,n,group,eq,mp:1000,w:2,hp:20,org:60,sa:0,ha:0,def:0,brk:0,arm:0,prc:0,spd:4,train:90,sup:.1,hard:0},o)];
DB.BAT = Object.fromEntries([
 B('inf','Пехота','inf',{inf_eq:100},{sa:6,ha:1,def:22,brk:3,prc:4}),
 B('mtn','Горная пехота','inf',{inf_eq:120},{org:70,sa:6,ha:1,def:20,brk:4,prc:4,tech:'t_mtn',ter:{mountain:.3,hills:.15}}),
 B('mar','Морская пехота','inf',{inf_eq:130},{org:70,sa:6,ha:1,def:20,brk:4,prc:4,tech:'t_mar',ter:{},amph:1}),
 B('para','Парашютисты','inf',{inf_eq:120},{hp:16,org:70,sa:5,ha:1,def:20,brk:4,prc:4,tech:'t_para'}),
 B('cav','Кавалерия','inf',{inf_eq:120},{hp:25,org:70,sa:4,ha:.5,def:18,brk:3,prc:2,spd:6}),
 B('mot','Мотопехота','inf',{inf_eq:100,mot_eq:35},{mp:1200,hp:25,sa:6,ha:1,def:22,brk:3,prc:4,spd:12,hard:.1,sup:.2,tech:'t_mot'}),
 B('mech','Механизированная','inf',{inf_eq:100,mech_eq:40},{hp:25,sa:8,ha:3,def:30,brk:8,arm:8,prc:10,spd:10,hard:.5,sup:.3,tech:'t_mech'}),
 B('ltk','Лёгкие танки','arm',{ltk_eq:60},{mp:500,hp:2,org:10,sa:6,ha:2,def:2,brk:20,arm:12,prc:15,spd:10,hard:.8,sup:.5,train:120,tech:'t_ltk1'}),
 B('mtk','Средние танки','arm',{mtk_eq:50},{mp:500,hp:2,org:10,sa:10,ha:6,def:4,brk:30,arm:35,prc:45,spd:9,hard:.9,sup:.6,train:120,tech:'t_mtk1'}),
 B('htk','Тяжёлые танки','arm',{htk_eq:40},{mp:500,hp:2,org:10,sa:14,ha:12,def:4,brk:40,arm:70,prc:80,spd:6,hard:.95,sup:.7,train:120,tech:'t_htk1'}),
 B('spg','САУ','art',{spg_eq:36},{mp:500,w:3,hp:2,org:0,sa:20,ha:4,def:3,brk:8,arm:15,prc:20,spd:9,hard:.7,sup:.4,tech:'t_spg'}),
 B('art','Артиллерия','art',{art_eq:24},{mp:500,w:3,hp:.6,org:0,sa:25,ha:2,def:4,brk:6,prc:5,sup:.3}),
 B('at','Противотанковые','art',{at_eq:24},{mp:500,w:1,hp:.6,org:0,sa:4,ha:18,def:4,brk:1,prc:60,sup:.1,tech:'t_at1'}),
 B('aa','Зенитные','art',{aa_eq:24},{mp:500,w:1,hp:.6,org:0,sa:3,ha:4,def:4,brk:1,prc:25,sup:.1,air:6,tech:'t_aa1'}),
 B('rkt','Реактивная артиллерия','art',{rkt_eq:24},{mp:500,w:3,hp:.6,org:0,sa:33,ha:1,def:2,brk:8,prc:5,spd:5,sup:.4,tech:'t_rkt'}),
]);
const S = (id,n,eq,o) => [id,Object.assign({id,n,eq,mp:300,w:0,hp:2,org:0,sa:0,ha:0,def:0,brk:0,arm:0,prc:0,sup:.03,hard:0},o)];
DB.SUP = Object.fromEntries([
 S('eng','Инженеры',{sup_eq:20},{def:6,brk:1,river:.5,fort:.2,ent:.3,tech:'t_eng'}),
 S('rec','Разведка',{sup_eq:10,inf_eq:30},{sa:.5,def:1,mp:200,plan:.15,tech:'t_rec'}),
 S('sig','Связь',{sup_eq:15},{def:1,mp:200,org_bonus:4,reserve:.3,tech:'t_sig'}),
 S('log','Тыл',{sup_eq:12},{def:1,mp:200,sup_mul:-.2,tech:'t_log'}),
 S('hos','Полевой госпиталь',{sup_eq:12},{def:1,mp:200,casualty:-.25,tech:'t_hos'}),
 S('mp_co','Военная полиция',{inf_eq:40},{def:2,mp:200,resist:.3,tech:'t_mp'}),
 S('s_art','Артиллерия поддержки',{art_eq:12},{sa:12,ha:1,def:2,brk:3,prc:5,sup:.1,tech:'t_sart'}),
 S('s_at','ПТО поддержки',{at_eq:12},{sa:2,ha:9,def:2,prc:50,sup:.05,tech:'t_sat'}),
 S('s_aa','ПВО поддержки',{aa_eq:12},{sa:1,ha:2,def:2,prc:20,air:4,sup:.05,tech:'t_saa'}),
]);

// Шаблоны: grid — 25 ячеек по колонкам (5 колонок по 5), sup — 5 ячеек
function tpl(name, cols, sup) { const g = Array(25).fill(null); cols.forEach((c, i) => c.forEach((b, j) => { g[i * 5 + j] = b; })); return { name, grid:g, sup:(sup || []).concat(Array(5)).slice(0, 5).map(x => x || null) }; }
DB.TPL = {
 inf:tpl('Пехотная дивизия',[['inf','inf','inf'],['inf','inf','inf'],['inf','inf','inf']]),
 mtn:tpl('Горная дивизия',[['mtn','mtn','mtn'],['mtn','mtn','mtn']]),
 cav:tpl('Кавалерийская дивизия',[['cav','cav'],['cav','cav']]),
 mot:tpl('Моторизованная дивизия',[['mot','mot','mot'],['mot','mot','mot']]),
 tank:tpl('Танковая дивизия',[['ltk','ltk'],['ltk','ltk'],['mot','mot'],['mot','mot']]),
};

// Корабли: без конструктора, модули в исследованиях.
DB.SHIP = {
 dd:{n:'Эсминец',cost:1500,res:{steel:1},hp:40,gun:6,tor:16,aa:4,spd:34,vis:12,det:18,asw:12},
 cl:{n:'Лёгкий крейсер',cost:3000,res:{steel:2,chr:.2},hp:70,gun:16,tor:8,aa:8,spd:32,vis:18,det:22,asw:4},
 ca:{n:'Тяжёлый крейсер',cost:6000,res:{steel:3,chr:.4},hp:110,gun:28,tor:4,aa:6,spd:32,vis:22,det:16,asw:0},
 bb:{n:'Линкор',cost:16000,res:{steel:6,chr:1},hp:300,gun:70,tor:0,aa:10,spd:26,vis:30,det:14,asw:0},
 cv:{n:'Авианосец',cost:18000,res:{steel:4,alu:1},hp:150,gun:60,tor:0,aa:12,spd:30,vis:32,det:30,asw:6},
 ss:{n:'Подводная лодка',cost:1100,res:{steel:.6},hp:20,gun:1,tor:20,aa:0,spd:14,vis:4,det:6,asw:0},
};
DB.SHIP_ORDER = ['dd','cl','ca','bb','cv','ss'];

DB.BUILD = {
 civ:{n:'Гражданский завод',cost:10800,slot:1}, mil:{n:'Военный завод',cost:7200,slot:1}, dock:{n:'Верфь',cost:6400,slot:1},
 infra:{n:'Дороги',cost:3000,max:5}, fort:{n:'Форт (провинция)',cost:500,max:10,prov:1}, aa:{n:'ПВО',cost:600,max:5}, air:{n:'Аэродром',cost:500,max:10}, synth:{n:'Синтетический завод',cost:14000,slot:1},
};

// Законы
DB.LAWS = {
 consc:{n:'Призыв',list:[
  {id:'volunteer',n:'Добровольцы',d:'1.5% населения',mp:.015,cost:0,mod:{}},
  {id:'limited',n:'Ограниченный призыв',d:'2.5% населения',mp:.025,cost:75,mod:{},war:.1},
  {id:'extensive',n:'Широкий призыв',d:'5% населения, −5% заводов',mp:.05,cost:150,mod:{work:-.05},war:.25},
  {id:'service',n:'Всеобщая служба',d:'10% населения, −10% заводов',mp:.1,cost:150,mod:{work:-.1},war:.5},
  {id:'all',n:'Все, кто может держать оружие',d:'20% населения, −25% заводов',mp:.2,cost:150,mod:{work:-.25},war:.7}]},
 econ:{n:'Экономика',list:[
  {id:'civil',n:'Гражданская',d:'Товары 35%, стройка −30%',cg:.35,cost:0,mod:{build:-.3,mil_build:-.3}},
  {id:'early',n:'Ранняя мобилизация',d:'Товары 30%, стройка −10%',cg:.3,cost:75,mod:{build:-.1}},
  {id:'partial',n:'Частичная мобилизация',d:'Товары 25%, стройка +10%',cg:.25,cost:150,mod:{build:.1},wt:25},
  {id:'war',n:'Военная экономика',d:'Товары 15%, выпуск +10%',cg:.15,cost:150,mod:{build:.1,prod:.1},war:.3},
  {id:'total',n:'Тотальная мобилизация',d:'Товары 5%, выпуск +20%, люди −10%',cg:.05,cost:150,mod:{build:.1,prod:.2,mp_mul:-.1},war:.6}]},
 trade:{n:'Торговля',list:[
  {id:'closed',n:'Закрытая',d:'Экспорт 0%',ex:0,cost:150,mod:{research:.02}},
  {id:'limited_ex',n:'Ограниченный экспорт',d:'Экспорт 25%',ex:.25,cost:75,mod:{}},
  {id:'export',n:'Экспортная',d:'Экспорт 50%, стройка +5%',ex:.5,cost:75,mod:{build:.05}},
  {id:'free',n:'Свободная торговля',d:'Экспорт 80%, стройка +10%, наука +5%',ex:.8,cost:75,mod:{build:.1,research:.05}}]},
 press:{n:'Пресса',list:[
  {id:'free_p',n:'Свободная пресса',d:'+0.15 власти, −5% поддержки войны',cost:0,mod:{pp:.15,warsup:-.05}},
  {id:'guided',n:'Управляемая пресса',d:'+5% стабильности',cost:75,mod:{stab:.05}},
  {id:'censor',n:'Цензура',d:'+5% поддержки войны, +5% стабильности, −0.1 власти',cost:75,mod:{warsup:.05,stab:.05,pp:-.1}},
  {id:'state_p',n:'Государственная пропаганда',d:'+15% поддержки войны, −5% стабильности, наука −5%',cost:100,mod:{warsup:.15,stab:-.05,research:-.05}}]},
 edu:{n:'Образование',list:[
  {id:'basic',n:'Базовое',d:'Без бонусов',cost:0,mod:{}},
  {id:'public',n:'Всеобщее',d:'+5% науки, −1% людей',cost:75,mod:{research:.05,mp_mul:-.01}},
  {id:'tech_e',n:'Техническое',d:'+10% науки, +3% выпуска, −3% людей',cost:150,mod:{research:.1,prod:.03,mp_mul:-.03}},
  {id:'mil_e',n:'Военные училища',d:'+15% опыта дивизий, +10% обучения',cost:100,mod:{div_xp:.15,train:.1}}]},
};
DB.LAW_DEFAULT = { consc:'volunteer', econ:'civil', trade:'export', press:'free_p', edu:'basic' };
DB.LAW_START = { GER:{econ:'partial',consc:'limited',press:'state_p',trade:'limited_ex',edu:'tech_e'}, SOV:{econ:'partial',consc:'limited',press:'state_p',trade:'closed',edu:'public'}, ITA:{econ:'early',consc:'limited',press:'state_p'}, ENG:{econ:'early',edu:'public',press:'guided'}, FRA:{econ:'early',consc:'limited',edu:'public'}, POL:{consc:'limited',econ:'early'} };

// Советники
const ADV = (id,slot,n,d,mod,bias) => ({ id,slot,n,d,mod,bias });
DB.ADVISORS = [
 ADV('a_tycoon','pol','Промышленный магнат','Стройка +10%',{build:.1}),
 ADV('a_econ','pol','Экономист-реформатор','Заводы +5% выпуска',{prod:.05}),
 ADV('a_silent','pol','Серый кардинал','+15% политической власти',{pp_mul:.15}),
 ADV('a_prop','pol','Министр пропаганды','+10% поддержки войны',{warsup:.1}),
 ADV('a_popular','pol','Народный трибун','+10% стабильности',{stab:.1}),
 ADV('a_diplomat','pol','Опытный дипломат','Дипломатия дешевле на 25%',{dipl:-.25}),
 ADV('a_general','staff','Начштаба: мобильная война','Скорость +5%, прорыв +5%',{spd:.05,brk:.05}),
 ADV('a_defense','staff','Начштаба: глубокая оборона','Защита +10%, окопы +10%',{def:.1,ent:.1}),
 ADV('a_assault','staff','Начштаба: штурм','Атака +7%',{sa:.07,ha:.07}),
 ADV('a_logist','staff','Начштаба: снабжение','Потребление снабжения −15%',{sup_use:-.15}),
 ADV('d_tank','bureau','КБ бронетехники','Исследования бронетехники +15%',{r_arm:.15}),
 ADV('d_art','bureau','КБ артиллерии','Исследования артиллерии +15%',{r_art:.15}),
 ADV('d_air','bureau','КБ авиации','Исследования авиации +15%',{r_air:.15}),
 ADV('d_navy','bureau','КБ судостроения','Исследования флота +15%',{r_nav:.15}),
 ADV('d_ind','bureau','Институт промышленности','Исследования индустрии +15%',{r_ind:.15}),
 ADV('d_ele','bureau','Институт электроники','Исследования электроники +15%',{r_ele:.15}),
 ADV('d_inf','bureau','Арсенал стрелкового оружия','Исследования пехоты и поддержки +15%',{r_inf:.15,r_sup:.15}),
];
DB.ADV_SLOTS = { pol:3, staff:1, bureau:3 };
DB.ADV_COST = { pol:150, staff:100, bureau:100 };
