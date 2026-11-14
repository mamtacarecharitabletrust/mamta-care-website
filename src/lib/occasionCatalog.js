/**
 * Mamta Care reusable, immutable event identities and independent artwork briefs.
 * A date is NOT assigned to a movable festival here; those come from the official
 * date overrides or the scheduled future-year holiday-data generator.
 * The official brand logo is never part of these artworks.
 */
const rows = [
  // id | title | category | visual | emblem | primary | accent | accompanying message
  ["new-year","Happy New Year","occasion","celebration","🎉","#144f55","#deb978","A new year of kindness, health and hope begins."],
  ["makar-sankranti","Happy Makar Sankranti","festival","harvest","🪁","#106b66","#f0bd59","May this harvest season bring warmth and new beginnings."],
  ["pongal","Happy Pongal","regional","harvest","🌾","#226c54","#e5af55","Celebrating gratitude, togetherness and a bountiful harvest."],
  ["magh-bihu","Happy Magh Bihu","regional","harvest","🌾","#276c4c","#d9bc73","Warm wishes of joy, abundance and community."],
  ["netaji-jayanti","Netaji Subhas Chandra Bose Jayanti","observance","heritage","🇮🇳","#135c4f","#e7b769","Honouring courage, service and dedication."],
  ["republic-day","Happy Republic Day","national","tricolour","🇮🇳","#174b59","#e9954c","Celebrating India's Constitution, dignity and unity."],
  ["world-cancer-day","World Cancer Day","awareness","cancer","🎗️","#285b66","#d8b268","Together for cancer awareness, compassion and support."],
  ["childhood-cancer-day","International Childhood Cancer Day","awareness","cancer","🎗️","#295c66","#dcbb69","Standing beside children and families affected by cancer."],
  ["maha-shivratri","Maha Shivaratri","festival","temple","🪷","#403e70","#bdb1ee","Wishing peace, strength and reflection."],
  ["womens-day","International Women's Day","awareness","women","🌷","#793e67","#e2a8cd","Celebrating women's strength, dignity and kindness."],
  ["world-health-day","World Health Day","awareness","health","🩺","#216b6a","#add5d0","Promoting health, dignity and accessible care for all."],
  ["basant-panchami","Basant Panchami","regional","flowers","🌼","#d7a63e","#eedb98","Wishing wisdom, learning and new beginnings."],
  ["world-water-day","World Water Day","awareness","nature","💧","#176a88","#9cdbeb","Every drop matters. Protecting water protects life."],
  ["holi","Happy Holi","festival","colours","🎨","#924565","#f4b150","May colours of hope and kindness brighten every life."],
  ["eid-ul-fitr","Eid Mubarak","festival","crescent","🌙","#155d58","#e6cd81","May this celebration bring peace, generosity and togetherness."],
  ["ugadi","Happy Ugadi","regional","flowers","🌺","#44662e","#e4bf6a","Wishing new beginnings filled with joy and goodwill."],
  ["gudi-padwa","Happy Gudi Padwa","regional","heritage","🌸","#954c45","#e3bd6b","A joyful new year of health, hope and happiness."],
  ["ram-navami","Ram Navami","festival","temple","🪷","#734f32","#eac16e","Wishing peace, devotion and kindness to all."],
  ["mahavir-jayanti","Mahavir Jayanti","festival","lotus","🪷","#8d643e","#e5cb86","Honouring compassion, nonviolence and respect for life."],
  ["good-friday","Good Friday","festival","reflection","🕊️","#39556b","#b8c5df","A day of reflection, compassion and hope."],
  ["easter","Happy Easter","festival","spring","🌷","#5477a0","#f0c987","Wishing renewal, kindness and hope for every family."],
  ["ambedkar-jayanti","Dr. B. R. Ambedkar Jayanti","national","heritage","📜","#30558c","#c2ae68","Honouring equality, dignity and constitutional values."],
  ["vaisakhi","Happy Vaisakhi","regional","harvest","🌾","#9a582c","#e7bd68","Warm wishes for a season of abundance and unity."],
  ["vishu","Happy Vishu","regional","harvest","🌼","#57783a","#d9b659","Wishing every family happiness and prosperity."],
  ["tamil-new-year","Happy Tamil New Year","regional","harvest","🌼","#326656","#dbaa57","May the new year bring kindness and hope."],
  ["bengali-new-year","Shubho Noboborsho","regional","harvest","🌸","#8d4050","#dfb67a","Wishing a joyful Bengali New Year."],
  ["earth-day","Earth Day","awareness","nature","🌍","#2e7356","#add5a2","Protecting our planet is an act of care."],
  ["labour-day","International Workers' Day","observance","community","🤝","#325c6a","#d5b478","Honouring the dignity and contribution of every worker."],
  ["buddha-purnima","Buddha Purnima","festival","lotus","🪷","#665a95","#e0c281","Wishing mindfulness, compassion and peace."],
  ["nurses-day","International Nurses Day","awareness","health","🩺","#2b6974","#b4d9d0","Thank you to caregivers who bring comfort and hope."],
  ["eid-ul-adha","Eid al-Adha Mubarak","festival","crescent","🌙","#176758","#e9c884","Warm wishes of generosity, community and peace."],
  ["environment-day","World Environment Day","awareness","nature","🌳","#287047","#b4d27d","A healthier planet means a healthier future."],
  ["blood-donor-day","World Blood Donor Day","awareness","health","❤️","#8c3845","#eaa6a7","Celebrating lifesaving generosity and compassion."],
  ["muharram","Observing Muharram","festival","reflection","🕊️","#374a63","#a6b5d0","A time for solemn remembrance, reflection and peace."],
  ["yoga-day","International Day of Yoga","awareness","lotus","🪷","#2f7d70","#9fcea6","Celebrating balance, well-being and inner strength."],
  ["doctors-day","National Doctors' Day","awareness","health","🩺","#296b75","#a0d9d4","Thanking doctors for their dedication and care."],
  ["rath-yatra","Rath Yatra","regional","temple","🪷","#98613e","#eac77a","Wishing peace, faith and community harmony."],
  ["youth-day","International Youth Day","awareness","community","🤝","#365b98","#c7d8e8","Celebrating the energy and hope of young people."],
  ["independence-day","Happy Independence Day","national","tricolour","🇮🇳","#124f64","#e7a35f","Celebrating freedom, unity and service to our country."],
  ["raksha-bandhan","Happy Raksha Bandhan","festival","threads","🧵","#8b486d","#e6bc7a","Celebrating the bonds of care and affection."],
  ["janmashtami","Happy Janmashtami","festival","peacock","🦚","#356a87","#dac274","Wishing peace, joy and kindness."],
  ["ganesh-chaturthi","Happy Ganesh Chaturthi","festival","flowers","🌺","#a45c43","#edc37e","Warm wishes for wisdom and good beginnings."],
  ["onam","Happy Onam","regional","harvest","🌼","#4b804e","#edb74f","Celebrating togetherness, gratitude and prosperity."],
  ["teachers-day","Happy Teachers' Day","observance","education","📚","#345c7c","#e3bb7c","Thank you to teachers who inspire tomorrow."],
  ["literacy-day","International Literacy Day","awareness","education","📖","#3c638c","#c0cce8","Opening doors to learning and opportunity."],
  ["hindi-diwas","Hindi Diwas","observance","heritage","📜","#7d5638","#e5c68a","Celebrating the richness of language and expression."],
  ["childhood-cancer-month","Childhood Cancer Awareness Month","awareness","cancer","🎗️","#78633b","#e2c875","Together, we stand beside children affected by cancer."],
  ["breast-cancer-month","Breast Cancer Awareness Month","awareness","cancer","🎗️","#9b557c","#eab8d8","Raising awareness and supporting those affected by breast cancer."],
  ["gandhi-jayanti","Gandhi Jayanti","national","heritage","🕊️","#42604d","#d7ba7b","Honouring nonviolence, service and compassion."],
  ["girl-child-day","International Day of the Girl Child","awareness","community","🌷","#9a5079","#e0bbd8","Every girl deserves opportunity, dignity and hope."],
  ["durga-puja","Happy Durga Puja","festival","flowers","🌺","#9d3f43","#e2b664","Wishing strength, joy and peace."],
  ["dussehra","Happy Dussehra","festival","heritage","🏹","#9d503d","#e7b660","Celebrating courage, goodness and new beginnings."],
  ["breast-cancer-day","Breast Cancer Awareness Day","awareness","cancer","🎗️","#a2547d","#efbad7","Early awareness and compassionate care matter."],
  ["karva-chauth","Karva Chauth","regional","moon","🌙","#985269","#edb98d","Warm wishes of love, commitment and care."],
  ["naraka-chaturdashi","Naraka Chaturdashi","festival","diya","🪔","#8c4a30","#e7b256","May light and kindness fill our hearts."],
  ["diwali","Happy Diwali","festival","diya","🪔","#764126","#efb854","May the festival of lights bring hope to every home."],
  ["govardhan-puja","Govardhan Puja","festival","flowers","🌺","#67713e","#e6c277","Wishing prosperity, care and harmony."],
  ["bhai-dooj","Happy Bhai Dooj","festival","threads","🌼","#a45d69","#edbd91","Celebrating love and caring family bonds."],
  ["chhath-puja","Chhath Puja","festival","sun","🌞","#a36a32","#f2cb6a","Warm wishes of gratitude, devotion and joy."],
  ["unity-day","National Unity Day","national","tricolour","🇮🇳","#185a60","#e7c17d","Celebrating the strength of India's unity."],
  ["guru-nanak","Guru Nanak Jayanti","festival","community","🪷","#3c6486","#d6b66e","Honouring equality, community and selfless service."],
  ["childrens-day","Happy Children's Day","awareness","children","♡","#176c60","#edbb75","Celebrating every child's right to hope, care and joy."],
  ["childrens-day-guru-nanak","Children's Day & Guru Nanak Jayanti","festival","children","♡","#176c60","#edbb75","Celebrating children, kindness, equality and the spirit of service."],
  ["disability-day","International Day of Persons with Disabilities","awareness","community","🤝","#526385","#c0cae6","Celebrating inclusion, accessibility and dignity for everyone."],
  ["volunteer-day","International Volunteer Day","awareness","community","🤝","#346a68","#c9d79d","Thanking every volunteer who gives time and compassion."],
  ["christmas-eve","Christmas Eve","festival","christmas","🎄","#215b4c","#e4bf82","A season of sharing, peace and hope."],
  ["christmas","Merry Christmas","festival","christmas","🎄","#125a48","#dfba76","May this season bring love, kindness and hope to every home."],
  ["milad-un-nabi","Milad-un-Nabi","festival","crescent","🌙","#356f67","#e2c884","Wishing peace, compassion and community harmony."],
];

export const OCCASIONS = Object.freeze(Object.fromEntries(
  rows.map(([id,title,category,visual,symbol,primary,accent,message]) => [
    id, Object.freeze({id,title,category,visual,symbol,primary,accent,message,artworkId:"mcct-art-"+id})
  ])
));

export const FIXED_ANNUAL = Object.freeze({
  "01-01":"new-year","01-14":"makar-sankranti","01-15":"pongal",
  "01-23":"netaji-jayanti","01-26":"republic-day",
  "02-04":"world-cancer-day","02-15":"childhood-cancer-day",
  "03-08":"womens-day","03-22":"world-water-day",
  "04-07":"world-health-day","04-14":"ambedkar-jayanti","04-22":"earth-day",
  "05-01":"labour-day","05-12":"nurses-day",
  "06-05":"environment-day","06-14":"blood-donor-day","06-21":"yoga-day",
  "07-01":"doctors-day","08-12":"youth-day","08-15":"independence-day",
  "09-01":"childhood-cancer-month","09-05":"teachers-day","09-08":"literacy-day","09-14":"hindi-diwas",
  "10-01":"breast-cancer-month","10-02":"gandhi-jayanti","10-11":"girl-child-day",
  "10-19":"breast-cancer-day","10-31":"unity-day",
  "11-14":"childrens-day","12-03":"disability-day","12-05":"volunteer-day",
  "12-24":"christmas-eve","12-25":"christmas"
});

export const MOVABLE_OFFICIAL = Object.freeze({
  // Official 2026 and 2027 central-government lists, with some regional
  // observances. Moon-sighting dates can change by official notification.
  "2026-01-23":"basant-panchami",
  "2026-02-15":"maha-shivratri",
  "2026-03-04":"holi",
  "2026-03-21":"eid-ul-fitr",
  "2026-03-26":"ram-navami",
  "2026-03-31":"mahavir-jayanti",
  "2026-04-03":"good-friday",
  "2026-04-05":"easter",
  "2026-04-14":"vaisakhi",
  "2026-05-01":"buddha-purnima",
  "2026-05-27":"eid-ul-adha",
  "2026-06-26":"muharram",
  "2026-07-16":"rath-yatra",
  "2026-08-26":"milad-un-nabi",
  "2026-09-04":"janmashtami",
  "2026-09-14":"ganesh-chaturthi",
  "2026-10-20":"dussehra",
  "2026-11-08":"diwali",
  "2026-11-09":"govardhan-puja",
  "2026-11-24":"guru-nanak",
  "2027-03-06":"maha-shivratri",
  "2027-03-10":"eid-ul-fitr",
  "2027-03-23":"holi",
  "2027-03-26":"good-friday",
  "2027-03-28":"easter",
  "2027-04-07":"ugadi",
  "2027-04-15":"ram-navami",
  "2027-04-19":"mahavir-jayanti",
  "2027-05-17":"eid-ul-adha",
  "2027-05-20":"buddha-purnima",
  "2027-06-16":"muharram",
  "2027-07-05":"rath-yatra",
  "2027-08-17":"raksha-bandhan",
  "2027-08-25":"janmashtami",
  "2027-09-04":"ganesh-chaturthi",
  "2027-09-12":"onam",
  "2027-10-06":"durga-puja",
  "2027-10-09":"dussehra",
  "2027-10-18":"karva-chauth",
  "2027-10-28":"naraka-chaturdashi",
  "2027-10-29":"diwali",
  "2027-10-30":"govardhan-puja",
  "2027-10-31":"bhai-dooj",
  "2027-11-04":"chhath-puja",
  "2027-11-14":"childrens-day-guru-nanak"
});

// Alternate observances when an important national event shares a date.
// The site's visitor sees one greeting, avoiding stacked mandatory popups.
export const DATE_SECONDARY = Object.freeze({
  "2026-05-01":["labour-day"],
  "2027-04-07":["gudi-padwa"],
  "2027-04-14":["vaisakhi","vishu","tamil-new-year"],
  "2027-04-15":["bengali-new-year"],
  "2027-08-15":["milad-un-nabi"],
  "2027-11-14":["childrens-day","guru-nanak"]
});

export const NATIONAL_IDS = Object.freeze([
 "republic-day","independence-day","gandhi-jayanti"
]);
