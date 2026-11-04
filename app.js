// ---- Storage fallback ----
// The original file used window.storage (only exists inside Claude's preview).
// In a normal browser we fall back to localStorage so your data still saves.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(key);
      if (v === null) throw new Error('Key not found');
      return { key, value: v };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true };
    }
  };
}

(function(){

let LANG = 'en';
let profiles = [];
let activeProfileId = null;
let profile = null;
let doses = {};      // vaccineId -> {date, facility, lot}
let symptomLog = [];
let facilityConfirms = {};

const STR = {
  en: {
    obTitle:"Set up the profile", obSub:"Enter a few details to generate the vaccine schedule. This stays on this device.",
    lblName:"Full name", lblDob:"Date of birth", lblSex:"Sex", optF:"Female", optM:"Male", btnCreate:"Create profile",
    brandSub:"Vaccine record",
    stUpcoming:"Upcoming & overdue", stCompleted:"Completed", stCardview:"Digital vaccine card",
    stCatalog:"Vaccine catalog", stFacilities:"Nearby facilities", stLog:"Report a symptom", stLogHistory:"Log history", stQr:"Shareable record",
    navHome:"Home", navCard:"Card", navCatalog:"Catalog", navFacilities:"Facilities", navLog:"Log", navQr:"QR",
    facilityNote:"Sample listings for this prototype. In production this pulls from a live, moderated dataset.",
    lblLogVaccine:"Which dose was this after?", lblLogSymptom:"Symptom", btnLogSymptom:"Check guidance",
    qrCaption:"Show this at a facility to share the record on file.",
    printCert:"Open printable certificate",
    upToDate:"up to date", dueCount:"due or overdue",
    noneUpcoming:"Nothing due right now.", noneCompleted:"No completed doses logged yet.",
    markDone:"Mark as given", cancel:"Cancel", save:"Save",
    dateGiven:"Date given", facilityGiven:"Facility", lotNumber:"Batch / lot number (optional)",
    due:"Due", overdue:"Overdue", done:"Done",
    doseOf:"Dose", confirmFacility:"Confirm this is still offered",
    confirmed:"confirmations", lastConfirmed:"Last confirmed",
    triageCommon:"This is a common, expected reaction. Rest, fluids, and a cool compress usually help. Monitor for the next 24–48 hours.",
    triageSeek:"This can signal a serious reaction. Seek care at the nearest facility now, and bring this record with you.",
    logged:"Logged", noLogs:"No symptoms logged yet.",
    certTitle:"International Certificate of Vaccination",
    certSub:"Generated from this device's records — verify against official facility records before travel.",
    certName:"Name", certDob:"Date of birth", certSex:"Sex",
    certVaccine:"Vaccine", certDate:"Date", certFacility:"Facility", certLot:"Lot #",
    psTitle:"Profiles", addProfile:"+ Add profile", editProfile:"Edit",
    pfTitleAdd:"Add profile", pfTitleEdit:"Edit profile", active:"Active",
    facilities:[
      {name:"Zewditu Memorial Hospital", addr:"Arada Sub-city, Addis Ababa", vaccines:["BCG","OPV","Penta","PCV","Measles"], confirmed:14, last:"2 weeks ago"},
      {name:"Bethzatha General Hospital", addr:"Kirkos Sub-city, Addis Ababa", vaccines:["Hepatitis B","COVID-19","Tetanus"], confirmed:6, last:"5 days ago"},
      {name:"Gandhi Memorial Hospital", addr:"Arada Sub-city, Addis Ababa", vaccines:["BCG","OPV","Penta","Measles","HPV"], confirmed:22, last:"3 days ago"},
      {name:"Kolfe Health Center", addr:"Kolfe Keranio, Addis Ababa", vaccines:["Penta","PCV","Rota","Measles"], confirmed:9, last:"1 week ago"},
      {name:"Yeka Health Center", addr:"Yeka Sub-city, Addis Ababa", vaccines:["OPV","Measles","Tetanus","Yellow Fever"], confirmed:4, last:"1 month ago"}
    ]
  },
  am: {
    obTitle:"መገለጫ ያዘጋጁ", obSub:"የክትባት መርሃ ግብር ለማመንጨት ጥቂት መረጃ ያስገቡ። መረጃው በዚህ መሣሪያ ላይ ብቻ ይቀመጣል።",
    lblName:"ሙሉ ስም", lblDob:"የትውልድ ቀን", lblSex:"ጾታ", optF:"ሴት", optM:"ወንድ", btnCreate:"መገለጫ ፍጠር",
    brandSub:"የክትባት መዝገብ",
    stUpcoming:"ወደፊት ያሉ እና ያመለጡ", stCompleted:"የተጠናቀቁ", stCardview:"ዲጂታል የክትባት ካርድ",
    stCatalog:"የክትባት ዝርዝር", stFacilities:"የአቅራቢያ ተቋማት", stLog:"ምልክት ሪፖርት ያድርጉ", stLogHistory:"የሪፖርት ታሪክ", stQr:"የሚጋራ መዝገብ",
    navHome:"መነሻ", navCard:"ካርድ", navCatalog:"ዝርዝር", navFacilities:"ተቋማት", navLog:"ሪፖርት", navQr:"QR",
    facilityNote:"ለዚህ ናሙና የተመረጡ ዝርዝሮች ናቸው። በትክክለኛ አገልግሎት ላይ ከቀጥታ፣ የተረጋገጠ ውሂብ ይመጣል።",
    lblLogVaccine:"ይህ ከየትኛው መጠን በኋላ ነው?", lblLogSymptom:"ምልክት", btnLogSymptom:"መመሪያ ይመልከቱ",
    qrCaption:"መዝገቡን ለማጋራት ይህንን በተቋም ውስጥ ያሳዩ።",
    printCert:"ማተሚያ የምስክር ወረቀት ይክፈቱ",
    upToDate:"የተሟላ", dueCount:"የሚጠበቁ ወይም ያመለጡ",
    noneUpcoming:"አሁን ምንም የሚጠበቅ ነገር የለም።", noneCompleted:"እስካሁን የተመዘገበ የተጠናቀቀ መጠን የለም።",
    markDone:"እንደተሰጠ ምልክት አድርግ", cancel:"ይቅር", save:"አስቀምጥ",
    dateGiven:"የተሰጠበት ቀን", facilityGiven:"ተቋም", lotNumber:"የባች ቁጥር (አማራጭ)",
    due:"ይጠበቃል", overdue:"አልፏል", done:"ተጠናቋል",
    doseOf:"መጠን", confirmFacility:"አሁንም እንደሚሰጥ ያረጋግጡ",
    confirmed:"ማረጋገጫዎች", lastConfirmed:"መጨረሻ የተረጋገጠው",
    triageCommon:"ይህ የተለመደ፣ የሚጠበቅ ምላሽ ነው። እረፍት፣ ፈሳሽ መጠጣት እና ቀዝቃዛ ጭምቅ ብዙ ጊዜ ይረዳል። ለሚቀጥሉት 24–48 ሰዓታት ይከታተሉ።",
    triageSeek:"ይህ ከባድ ምላሽ ሊያመለክት ይችላል። አሁኑኑ ወደ ቅርብ ተቋም ይሂዱ፣ ይህንን መዝገብ ይዘው ይሂዱ።",
    logged:"ተመዝግቧል", noLogs:"እስካሁን ምንም ምልክት አልተመዘገበም።",
    certTitle:"ዓለም አቀፍ የክትባት ምስክር ወረቀት",
    certSub:"ከዚህ መሣሪያ መዝገብ የተፈጠረ — ከመጓዝዎ በፊት ከይፋዊ የተቋም መዝገቦች ጋር ያረጋግጡ።",
    certName:"ስም", certDob:"የትውልድ ቀን", certSex:"ጾታ",
    certVaccine:"ክትባት", certDate:"ቀን", certFacility:"ተቋም", certLot:"የባች ቁ.",
    psTitle:"መገለጫዎች", addProfile:"+ መገለጫ ጨምር", editProfile:"አርም",
    pfTitleAdd:"መገለጫ ጨምር", pfTitleEdit:"መገለጫ አርም", active:"ንቁ",
    facilities:[
      {name:"ዘውዲቱ መታሰቢያ ሆስፒታል", addr:"አራዳ ክፍለ ከተማ፣ አዲስ አበባ", vaccines:["BCG","OPV","Penta","PCV","Measles"], confirmed:14, last:"ከ2 ሳምንት በፊት"},
      {name:"ቤዛታ ጠቅላላ ሆስፒታል", addr:"ቂርቆስ ክፍለ ከተማ፣ አዲስ አበባ", vaccines:["Hepatitis B","COVID-19","Tetanus"], confirmed:6, last:"ከ5 ቀናት በፊት"},
      {name:"ጋንዲ መታሰቢያ ሆስፒታል", addr:"አራዳ ክፍለ ከተማ፣ አዲስ አበባ", vaccines:["BCG","OPV","Penta","Measles","HPV"], confirmed:22, last:"ከ3 ቀናት በፊት"},
      {name:"ኮልፌ ጤና ጣቢያ", addr:"ኮልፌ ቀራንዮ፣ አዲስ አበባ", vaccines:["Penta","PCV","Rota","Measles"], confirmed:9, last:"ከ1 ሳምንት በፊት"},
      {name:"የካ ጤና ጣቢያ", addr:"የካ ክፍለ ከተማ፣ አዲስ አበባ", vaccines:["OPV","Measles","Tetanus","Yellow Fever"], confirmed:4, last:"ከ1 ወር በፊት"}
    ]
  }
};

// Simplified Ethiopian EPI + adolescent/adult schedule.
// offsetDays: from DOB, for childhood track. ageYears: trigger age for adolescent/adult.
const VACCINES = [
  {id:"bcg", en:"BCG", am:"ቢሲጂ", track:"childhood", offsetDays:0, dose:"1/1",
   infoEn:"Given at birth to protect against tuberculosis. Single dose, injected in the upper arm.",
   infoAm:"በወሊድ ጊዜ የሚሰጥ፣ የሳንባ ነቀርሳን ለመከላከል። አንድ መጠን፣ በላይኛው ክንድ ላይ ይሰጣል።"},
  {id:"opv0", en:"OPV — birth dose", am:"OPV — የወሊድ መጠን", track:"childhood", offsetDays:0, dose:"0/4",
   infoEn:"Oral polio vaccine given within two weeks of birth.", infoAm:"ከወሊድ በኋላ በሁለት ሳምንት ውስጥ የሚሰጥ የፖሊዮ ክትባት (በአፍ)።"},
  {id:"penta1", en:"Pentavalent 1", am:"ፔንታቫለንት 1", track:"childhood", offsetDays:42, dose:"1/3",
   infoEn:"Protects against diphtheria, pertussis, tetanus, Hepatitis B and Hib. First of three doses, at 6 weeks.",
   infoAm:"ዲፍቴሪያ፣ ትክትክ ሳል፣ ቴታነስ፣ ሄፓታይተስ ቢ እና ሂብን ይከላከላል። ከሦስቱ የመጀመሪያው፣ በ6 ሳምንት።"},
  {id:"pcv1", en:"PCV 1", am:"PCV 1", track:"childhood", offsetDays:42, dose:"1/3",
   infoEn:"Pneumococcal conjugate vaccine, protects against pneumonia and meningitis. First dose at 6 weeks.",
   infoAm:"የሳንባ ምች እና ማጅራት ገትር በሽታን ይከላከላል። የመጀመሪያ መጠን በ6 ሳምንት።"},
  {id:"rota1", en:"Rotavirus 1", am:"ሮታቫይረስ 1", track:"childhood", offsetDays:42, dose:"1/2",
   infoEn:"Oral vaccine protecting against severe diarrhea caused by rotavirus. First dose at 6 weeks.",
   infoAm:"በሮታቫይረስ የሚመጣ ከባድ ተቅማጥን ይከላከላል፣ በአፍ የሚሰጥ። የመጀመሪያ መጠን በ6 ሳምንት።"},
  {id:"opv1", en:"OPV 1", am:"OPV 1", track:"childhood", offsetDays:42, dose:"1/4",
   infoEn:"Second dose of oral polio vaccine, at 6 weeks.", infoAm:"ሁለተኛው የፖሊዮ ክትባት መጠን፣ በ6 ሳምንት።"},
  {id:"penta2", en:"Pentavalent 2", am:"ፔንታቫለንት 2", track:"childhood", offsetDays:70, dose:"2/3",
   infoEn:"Second dose, at 10 weeks.", infoAm:"ሁለተኛ መጠን፣ በ10 ሳምንት።"},
  {id:"pcv2", en:"PCV 2", am:"PCV 2", track:"childhood", offsetDays:70, dose:"2/3",
   infoEn:"Second dose, at 10 weeks.", infoAm:"ሁለተኛ መጠን፣ በ10 ሳምንት።"},
  {id:"rota2", en:"Rotavirus 2", am:"ሮታቫይረስ 2", track:"childhood", offsetDays:70, dose:"2/2",
   infoEn:"Second and final dose, at 10 weeks.", infoAm:"ሁለተኛ እና የመጨረሻ መጠን፣ በ10 ሳምንት።"},
  {id:"opv2", en:"OPV 2", am:"OPV 2", track:"childhood", offsetDays:70, dose:"2/4",
   infoEn:"Third dose of oral polio vaccine, at 10 weeks.", infoAm:"ሦስተኛው የፖሊዮ ክትባት መጠን፣ በ10 ሳምንት።"},
  {id:"penta3", en:"Pentavalent 3", am:"ፔንታቫለንት 3", track:"childhood", offsetDays:98, dose:"3/3",
   infoEn:"Third and final dose, at 14 weeks.", infoAm:"ሦስተኛ እና የመጨረሻ መጠን፣ በ14 ሳምንት።"},
  {id:"pcv3", en:"PCV 3", am:"PCV 3", track:"childhood", offsetDays:98, dose:"3/3",
   infoEn:"Third and final dose, at 14 weeks.", infoAm:"ሦስተኛ እና የመጨረሻ መጠን፣ በ14 ሳምንት።"},
  {id:"ipv", en:"IPV", am:"IPV", track:"childhood", offsetDays:98, dose:"1/1",
   infoEn:"Inactivated polio vaccine, injected. Given at 14 weeks alongside the oral doses.",
   infoAm:"በመርፌ የሚሰጥ የፖሊዮ ክትባት። ከአፍ ክትባቶች ጋር በ14 ሳምንት ይሰጣል።"},
  {id:"opv3", en:"OPV 3", am:"OPV 3", track:"childhood", offsetDays:98, dose:"3/4",
   infoEn:"Fourth dose of oral polio vaccine, at 14 weeks.", infoAm:"አራተኛው የፖሊዮ ክትባት መጠን፣ በ14 ሳምንት።"},
  {id:"vitA1", en:"Vitamin A (1st)", am:"ቫይታሚን ኤ (1ኛ)", track:"childhood", offsetDays:270, dose:"1/2",
   infoEn:"High-dose vitamin A supplement at 9 months, supports immunity and eye health.",
   infoAm:"በ9 ወር የሚሰጥ ከፍተኛ መጠን ቫይታሚን ኤ፣ የበሽታ መከላከልን እና የዓይን ጤናን ይደግፋል።"},
  {id:"measles1", en:"Measles 1", am:"ኩፍኝ 1", track:"childhood", offsetDays:270, dose:"1/2",
   infoEn:"First measles dose at 9 months.", infoAm:"የመጀመሪያ የኩፍኝ መጠን በ9 ወር።"},
  {id:"measles2", en:"Measles 2", am:"ኩፍኝ 2", track:"childhood", offsetDays:456, dose:"2/2",
   infoEn:"Second and final measles dose at 15 months.", infoAm:"ሁለተኛ እና የመጨረሻ የኩፍኝ መጠን በ15 ወር።"},
  {id:"hpv1", en:"HPV 1", am:"HPV 1", track:"adolescent", ageYears:14, sex:"female", dose:"1/2",
   infoEn:"Protects against HPV-related cervical cancer. Given to girls from age 14. First of two doses, 6 months apart.",
   infoAm:"ከHPV ጋር የተያያዘ የማህጸን ጫፍ ካንሰርን ይከላከላል። ከ14 ዓመት ለሆኑ ሴቶች ልጆች ይሰጣል። ከሁለቱ የመጀመሪያው፣ በ6 ወር ልዩነት።"},
  {id:"hpv2", en:"HPV 2", am:"HPV 2", track:"adolescent", ageYears:14.5, sex:"female", dose:"2/2",
   infoEn:"Second and final HPV dose, 6 months after the first.", infoAm:"ሁለተኛ እና የመጨረሻ የHPV መጠን፣ ከመጀመሪያው ከ6 ወር በኋላ።"},
  {id:"hepb_adult", en:"Hepatitis B (adult)", am:"ሄፓታይተስ ቢ (ለአዋቂ)", track:"adult", ageYears:18, dose:"series",
   infoEn:"Recommended for adults not vaccinated in childhood, especially healthcare workers.",
   infoAm:"በልጅነት ላልተከተቡ አዋቂዎች፣ በተለይም ለጤና ባለሙያዎች ይመከራል።"},
  {id:"td_booster", en:"Tetanus-diphtheria booster", am:"የቴታነስ-ዲፍቴሪያ ማጠናከሪያ", track:"adult", ageYears:18, dose:"booster",
   infoEn:"Booster every 10 years, or per wound-care guidance.", infoAm:"በየ10 ዓመቱ የሚሰጥ ማጠናከሪያ፣ ወይም እንደ ቁስል እንክብካቤ መመሪያ።"},
  {id:"covid_adult", en:"COVID-19", am:"ኮቪድ-19", track:"adult", ageYears:18, dose:"series",
   infoEn:"Per current national guidance for adults and high-risk groups.", infoAm:"በአሁኑ ብሔራዊ መመሪያ መሠረት ለአዋቂዎች እና ከፍተኛ ተጋላጭ ቡድኖች።"},
  {id:"yellow_fever", en:"Yellow Fever", am:"ቢጫ ወባ (የሎ ፊቨር)", track:"adult", ageYears:18, dose:"1/1", travel:true,
   infoEn:"Not part of routine schedule — required for travel to/from certain countries. Valid for life after one dose.",
   infoAm:"የመደበኛ መርሃ ግብር አካል አይደለም — ወደ አንዳንድ አገራት ለመጓዝ ያስፈልጋል። ከአንድ መጠን በኋላ በህይወት ዘመን የሚሰራ።"}
];

function t(key){ return STR[LANG][key] || key; }
function vname(v){ return LANG==='en' ? v.en : v.am; }
function vinfo(v){ return LANG==='en' ? v.infoEn : v.infoAm; }

function daysBetween(a,b){ return Math.floor((b-a)/(1000*60*60*24)); }

function dueDateFor(v, dob){
  if(v.offsetDays !== undefined){
    const d = new Date(dob); d.setDate(d.getDate()+v.offsetDays); return d;
  }
  if(v.ageYears !== undefined){
    const d = new Date(dob); d.setMonth(d.getMonth()+Math.round(v.ageYears*12)); return d;
  }
  return null;
}

function eligibleVaccines(){
  if(!profile) return [];
  return VACCINES.filter(v => !v.sex || v.sex === profile.sex);
}

function statusFor(v){
  const logged = doses[v.id];
  if(logged) return 'done';
  const due = dueDateFor(v, new Date(profile.dob));
  const today = new Date();
  if(due <= today) return daysBetween(due, today) > 14 ? 'overdue' : 'due';
  return 'upcoming';
}

async function loadAll(){
  let stored = null;
  try{
    const pr = await window.storage.get('profiles', false);
    stored = pr ? JSON.parse(pr.value) : null;
  }catch(e){ stored = null; }

  if(stored){
    profiles = stored;
  } else {
    // migrate a legacy single-profile save, if one exists
    profiles = [];
    try{
      const legacy = await window.storage.get('profile', false);
      if(legacy){
        const p = JSON.parse(legacy.value);
        p.id = 'p_' + Date.now();
        profiles = [p];
        try{
          const d = await window.storage.get('doses', false);
          if(d) await window.storage.set('doses:'+p.id, d.value, false);
        }catch(e){}
        try{
          const s = await window.storage.get('symptomLog', false);
          if(s) await window.storage.set('log:'+p.id, s.value, false);
        }catch(e){}
      }
    }catch(e){}
  }

  try{
    const a = await window.storage.get('activeProfileId', false);
    activeProfileId = a ? a.value : null;
  }catch(e){ activeProfileId = null; }

  if(!activeProfileId || !profiles.find(p=>p.id===activeProfileId)){
    activeProfileId = profiles.length ? profiles[0].id : null;
  }
  profile = profiles.find(p=>p.id===activeProfileId) || null;

  if(profile){ await saveProfiles(); await saveActiveId(); }

  await loadProfileData();

  try{
    const l = await window.storage.get('lang', false);
    LANG = l ? l.value : 'en';
  }catch(e){ LANG = 'en'; }
}

async function loadProfileData(){
  if(!activeProfileId){ doses = {}; symptomLog = []; return; }
  try{
    const d = await window.storage.get('doses:'+activeProfileId, false);
    doses = d ? JSON.parse(d.value) : {};
  }catch(e){ doses = {}; }
  try{
    const s = await window.storage.get('log:'+activeProfileId, false);
    symptomLog = s ? JSON.parse(s.value) : [];
  }catch(e){ symptomLog = []; }
}

async function saveProfiles(){ try{ await window.storage.set('profiles', JSON.stringify(profiles), false);}catch(e){} }
async function saveActiveId(){ try{ await window.storage.set('activeProfileId', activeProfileId, false);}catch(e){} }
async function saveDoses(){ try{ await window.storage.set('doses:'+activeProfileId, JSON.stringify(doses), false);}catch(e){} }
async function saveLog(){ try{ await window.storage.set('log:'+activeProfileId, JSON.stringify(symptomLog), false);}catch(e){} }
async function saveLang(){ try{ await window.storage.set('lang', LANG, false);}catch(e){} }

function fmtDate(d){
  return d.toLocaleDateString(LANG==='en'?'en-GB':'en-GB', {day:'numeric', month:'short', year:'numeric'});
}

function applyStaticStrings(){
  document.getElementById('ob-title').textContent = t('obTitle');
  document.getElementById('ob-sub').textContent = t('obSub');
  document.getElementById('lbl-name').textContent = t('lblName');
  document.getElementById('lbl-dob').textContent = t('lblDob');
  document.getElementById('lbl-sex').textContent = t('lblSex');
  document.getElementById('opt-f').textContent = t('optF');
  document.getElementById('opt-m').textContent = t('optM');
  document.getElementById('btn-create').textContent = t('btnCreate');
  document.getElementById('st-upcoming').textContent = t('stUpcoming');
  document.getElementById('st-completed').textContent = t('stCompleted');
  document.getElementById('st-catalog').textContent = t('stCatalog');
  document.getElementById('st-facilities').textContent = t('stFacilities');
  document.getElementById('st-log').textContent = t('stLog');
  document.getElementById('st-log-history').textContent = t('stLogHistory');
  document.getElementById('st-qr').textContent = t('stQr');
  document.getElementById('facility-note').textContent = t('facilityNote');
  document.getElementById('lbl-log-vaccine').textContent = t('lblLogVaccine');
  document.getElementById('lbl-log-symptom').textContent = t('lblLogSymptom');
  document.getElementById('btn-log-symptom').textContent = t('btnLogSymptom');
  document.getElementById('qr-caption').textContent = t('qrCaption');
  document.getElementById('btn-print-cert').textContent = t('printCert');
  document.getElementById('ps-title').textContent = t('psTitle');
  document.getElementById('btn-add-profile').textContent = t('addProfile');
  document.getElementById('pf-lbl-name').textContent = t('lblName');
  document.getElementById('pf-lbl-dob').textContent = t('lblDob');
  document.getElementById('pf-lbl-sex').textContent = t('lblSex');
  document.getElementById('pf-opt-f').textContent = t('optF');
  document.getElementById('pf-opt-m').textContent = t('optM');
  document.getElementById('pf-cancel').textContent = t('cancel');
  document.getElementById('pf-save').textContent = t('save');
  renderProfileChip();
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const map = {'nav-home':'navHome','nav-card':'navCard','nav-catalog':'navCatalog','nav-facilities':'navFacilities','nav-log':'navLog','nav-qr':'navQr'};
    el.textContent = t(map[el.dataset.i18n]);
  });
}

function initials(name){
  return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

function renderProfileChip(){
  if(!profile) return;
  document.getElementById('profileChipAvatar').textContent = initials(profile.name);
  document.getElementById('profileChipName').textContent = profile.name;
}

function renderHome(){
  const el = eligibleVaccines();
  const upcoming = el.filter(v=>['due','overdue'].includes(statusFor(v)));
  const completed = el.filter(v=>statusFor(v)==='done');

  const bannerEl = document.getElementById('home-banner');
  if(upcoming.length===0){
    bannerEl.innerHTML = `<div class="status-banner ok"><div><div class="num">${completed.length}</div><div class="lbl">${t('upToDate')}</div></div></div>`;
  } else {
    bannerEl.innerHTML = `<div class="status-banner warn"><div><div class="num">${upcoming.length}</div><div class="lbl">${t('dueCount')}</div></div></div>`;
  }

  const upEl = document.getElementById('home-upcoming');
  upEl.innerHTML = '';
  if(upcoming.length===0){
    upEl.innerHTML = `<div class="empty">${t('noneUpcoming')}</div>`;
  } else {
    upcoming.sort((a,b)=>dueDateFor(a,new Date(profile.dob)) - dueDateFor(b,new Date(profile.dob)));
    upcoming.forEach(v=>{
      const status = statusFor(v);
      const due = dueDateFor(v, new Date(profile.dob));
      const card = document.createElement('div');
      card.className = 'dose-card '+status;
      card.innerHTML = `<div><div class="name">${vname(v)}</div><div class="meta">${fmtDate(due)}</div></div><span class="tag ${status}">${t(status)}</span>`;
      card.onclick = ()=>openDoseModal(v);
      upEl.appendChild(card);
    });
  }

  const compEl = document.getElementById('home-completed');
  compEl.innerHTML = '';
  if(completed.length===0){
    compEl.innerHTML = `<div class="empty">${t('noneCompleted')}</div>`;
  } else {
    completed.forEach(v=>{
      const log = doses[v.id];
      const card = document.createElement('div');
      card.className = 'dose-card done';
      card.innerHTML = `<div><div class="name">${vname(v)}</div><div class="meta">${log.date}${log.facility? ' · '+log.facility:''}</div></div><span class="tag done">${t('done')}</span>`;
      compEl.appendChild(card);
    });
  }
}

function idFor(profile){
  const src = (profile.name+profile.dob).toUpperCase();
  let h = 0;
  for(let i=0;i<src.length;i++){ h = (h*31 + src.charCodeAt(i)) >>> 0; }
  const digits = String(h).padStart(9,'0').slice(0,9);
  return `ET-${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,9)}`;
}

const SEAL_SVG = `<svg class="oc-seal" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="46" fill="none" stroke="#1C5C4B" stroke-width="1.6"/>
  <circle cx="50" cy="50" r="38" fill="none" stroke="#1C5C4B" stroke-width="1"/>
  <path d="M50 22 L58 44 L50 40 L42 44 Z" fill="#1C5C4B"/>
  <path d="M50 78 L58 56 L50 60 L42 56 Z" fill="#1C5C4B"/>
  <circle cx="50" cy="50" r="9" fill="none" stroke="#1C5C4B" stroke-width="1.6"/>
  <path d="M50 41 L50 59 M41 50 L59 50" stroke="#1C5C4B" stroke-width="1.6"/>
</svg>`;

const EMBLEM_SVG = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <circle cx="20" cy="20" r="18" fill="none" stroke="#1C5C4B" stroke-width="1.6"/>
  <path d="M20 9 L23.5 17.5 L32.5 17.5 L25.5 23 L28 32 L20 26.5 L12 32 L14.5 23 L7.5 17.5 L16.5 17.5 Z" fill="#C79A3C"/>
</svg>`;

function renderCard(){
  const wrap = document.getElementById('official-card');
  wrap.innerHTML = '';
  if(!profile) return;

  const el = eligibleVaccines();
  const byTrack = {childhood:[], adolescent:[], adult:[]};
  el.forEach(v=>byTrack[v.track].push(v));
  const trackLabelsEn = {childhood:'Childhood — EPI', adolescent:'Adolescent', adult:'Adult'};
  const trackLabelsAm = {childhood:'የልጅነት — EPI', adolescent:'ጎረምሳ', adult:'አዋቂ'};

  const head = document.createElement('div');
  head.className = 'oc-head';
  head.innerHTML = `<div class="oc-emblem">${EMBLEM_SVG}</div>
    <div class="oc-title-en">${LANG==='en'?'National Immunization Record':'ብሔራዊ የክትባት መዝገብ'}</div>
    <div class="oc-title-am">${LANG==='en'?'ብሔራዊ የክትባት መዝገብ':'National Immunization Record'}</div>
    <div class="oc-rule"></div>`;
  wrap.appendChild(head);

  const body = document.createElement('div');
  body.className = 'oc-body';
  body.innerHTML = SEAL_SVG;

  const profileGrid = document.createElement('div');
  profileGrid.className = 'oc-profile';
  const dobDisplay = fmtDate(new Date(profile.dob));
  profileGrid.innerHTML = `
    <div class="oc-field wide"><div class="k">${LANG==='en'?'FULL NAME':'ሙሉ ስም'}</div><div class="v">${profile.name}</div></div>
    <div class="oc-field"><div class="k">${LANG==='en'?'DATE OF BIRTH':'የትውልድ ቀን'}</div><div class="v">${dobDisplay}</div></div>
    <div class="oc-field"><div class="k">${LANG==='en'?'SEX':'ጾታ'}</div><div class="v">${t(profile.sex==='female'?'optF':'optM')}</div></div>
    <div class="oc-field"><div class="k">${LANG==='en'?'RECORD ID':'የመዝገብ ቁጥር'}</div><div class="v">${idFor(profile)}</div></div>
    <div class="oc-field"><div class="k">${LANG==='en'?'ISSUED':'የተሰጠበት'}</div><div class="v">${fmtDate(new Date())}</div></div>`;
  body.appendChild(profileGrid);

  Object.keys(byTrack).forEach(track=>{
    if(byTrack[track].length===0) return;
    const band = document.createElement('div');
    band.className = 'oc-track-band';
    band.innerHTML = `<span>${LANG==='en'?trackLabelsEn[track]:trackLabelsAm[track]}</span><span class="am">${LANG==='en'?trackLabelsAm[track]:trackLabelsEn[track]}</span>`;
    body.appendChild(band);

    byTrack[track].forEach(v=>{
      const status = statusFor(v);
      const due = dueDateFor(v, new Date(profile.dob));
      const log = doses[v.id];
      const row = document.createElement('div');
      row.className = 'oc-row';
      const doseLbl = v.dose ? `${t('doseOf')} ${v.dose} · ` : '';
      const dateLine = status==='done' ? (log.date+(log.facility?' · '+log.facility:'')) : fmtDate(due);
      const stampLabel = status==='done' ? (LANG==='en'?'ISSUED':'ተሰጥቷል') : status==='overdue' ? (LANG==='en'?'OVERDUE':'አልፏል') : (LANG==='en'?'DUE':'ይጠበቃል');
      row.innerHTML = `
        <div><div class="rn">${vname(v)}</div><div class="rd">${doseLbl}${dateLine}</div></div>
        <div class="oc-stamp ${status==='upcoming'?'due':status}">${stampLabel}</div>`;
      row.onclick = ()=>openDoseModal(v);
      body.appendChild(row);
    });
  });

  wrap.appendChild(body);

  const foot = document.createElement('div');
  foot.className = 'oc-foot';
  foot.innerHTML = `<span>${LANG==='en'?'Valid with facility verification':'ከተቋም ማረጋገጫ ጋር የሚሰራ'}</span>`;
  wrap.appendChild(foot);

  ['','',''].forEach(()=>{});
  const c1 = document.createElement('div'); c1.className='oc-corner-b1'; wrap.appendChild(c1);
  const c2 = document.createElement('div'); c2.className='oc-corner-b2'; wrap.appendChild(c2);
}

function renderCatalog(){
  const el = eligibleVaccines();
  const listEl = document.getElementById('catalog-list');
  listEl.innerHTML = '';
  const trackLabelsEn = {childhood:'Childhood', adolescent:'Adolescent', adult:'Adult'};
  const trackLabelsAm = {childhood:'የልጅነት', adolescent:'ጎረምሳ', adult:'አዋቂ'};
  el.forEach(v=>{
    const item = document.createElement('div');
    item.className = 'catalog-item';
    item.innerHTML = `<span class="track-tag">${LANG==='en'?trackLabelsEn[v.track]:trackLabelsAm[v.track]}</span>
      <h3>${vname(v)}</h3><p>${vinfo(v)}</p>`;
    listEl.appendChild(item);
  });
}

function renderFacilities(){
  const listEl = document.getElementById('facility-list');
  listEl.innerHTML = '';
  t('facilities').forEach((f,idx)=>{
    const extra = facilityConfirms[idx] || 0;
    const card = document.createElement('div');
    card.className = 'facility-card';
    card.innerHTML = `<h3>${f.name}</h3><div class="addr">${f.addr}</div>
      <div class="chips">${f.vaccines.map(v=>`<span class="chip">${v}</span>`).join('')}</div>
      <div class="confirm-row"><span>${t('lastConfirmed')}: ${f.last} · ${f.confirmed+extra} ${t('confirmed')}</span>
      <button class="btn small secondary" data-idx="${idx}">${t('confirmFacility')}</button></div>`;
    card.querySelector('button').onclick = (e)=>{
      facilityConfirms[idx] = (facilityConfirms[idx]||0)+1;
      renderFacilities();
    };
    listEl.appendChild(card);
  });
}

function renderLogTab(){
  const sel = document.getElementById('log-vaccine');
  sel.innerHTML = '';
  Object.keys(doses).forEach(id=>{
    const v = VACCINES.find(x=>x.id===id);
    if(!v) return;
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = vname(v);
    sel.appendChild(opt);
  });
  if(sel.children.length===0){
    const opt = document.createElement('option');
    opt.textContent = LANG==='en' ? 'No logged doses yet' : 'እስካሁን የተመዘገበ መጠን የለም';
    sel.appendChild(opt);
  }
  renderLogHistory();
}

const SEVERE = new Set(['fever_high','breathing','seizure','swelling_severe']);
const SYMPTOM_LABELS = {
  fever_mild:{en:'Mild fever', am:'መጠነኛ ትኩሳት'},
  fever_high:{en:'High fever (39°C+)', am:'ከፍተኛ ትኩሳት (39°C+)'},
  soreness:{en:'Soreness / swelling at injection site', am:'በመርፌ ቦታ ላይ ህመም/እብጠት'},
  rash:{en:'Rash', am:'ሽፍታ'},
  fussiness:{en:'Fussiness / crying more than usual', am:'ከወትሮው በላይ ማልቀስ'},
  breathing:{en:'Difficulty breathing', am:'የመተንፈስ ችግር'},
  seizure:{en:'Seizure or convulsion', am:'መናወጥ ወይም ንዝረት'},
  swelling_severe:{en:'Severe swelling of face/throat', am:'ከባድ የፊት/ጉሮሮ እብጠት'}
};

function renderLogHistory(){
  const el = document.getElementById('log-history');
  el.innerHTML = '';
  if(symptomLog.length===0){ el.innerHTML = `<div class="empty">${t('noLogs')}</div>`; return; }
  symptomLog.slice().reverse().forEach(entry=>{
    const v = VACCINES.find(x=>x.id===entry.vaccineId);
    const card = document.createElement('div');
    card.className = 'dose-card '+(entry.severe?'overdue':'done');
    const label = SYMPTOM_LABELS[entry.symptom] ? SYMPTOM_LABELS[entry.symptom][LANG] : entry.symptom;
    card.innerHTML = `<div><div class="name">${label}</div><div class="meta">${v?vname(v):''} · ${entry.date}</div></div>`;
    el.appendChild(card);
  });
}

function renderQR(){
  const box = document.getElementById('qrcanvas');
  box.innerHTML = '';
  if(!profile) return;
  const payload = {
    name: profile.name, dob: profile.dob, sex: profile.sex,
    doses: Object.keys(doses).map(id=>({id, ...doses[id]}))
  };
  try{
    new QRCode(box, { text: JSON.stringify(payload), width:180, height:180, colorDark:'#1C5C4B', colorLight:'#ffffff' });
  }catch(e){
    box.textContent = 'QR unavailable offline';
  }
}

function buildCertificate(){
  const cert = document.getElementById('certificate');
  const completedList = eligibleVaccines().filter(v=>doses[v.id]);
  cert.innerHTML = `
    <h2>${t('certTitle')}</h2>
    <div class="sub">${t('certSub')}</div>
    <table>
      <tr><th>${t('certName')}</th><td>${profile.name}</td></tr>
      <tr><th>${t('certDob')}</th><td>${profile.dob}</td></tr>
      <tr><th>${t('certSex')}</th><td>${t(profile.sex==='female'?'optF':'optM')}</td></tr>
    </table>
    <table>
      <tr><th>${t('certVaccine')}</th><th>${t('certDate')}</th><th>${t('certFacility')}</th><th>${t('certLot')}</th></tr>
      ${completedList.map(v=>{
        const d = doses[v.id];
        return `<tr><td>${vname(v)}</td><td>${d.date}</td><td>${d.facility||'—'}</td><td>${d.lot||'—'}</td></tr>`;
      }).join('')}
    </table>`;
}

function openDoseModal(v){
  const overlay = document.getElementById('doseOverlay');
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = vname(v);
  const existing = doses[v.id];
  body.innerHTML = `
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.5;">${vinfo(v)}</p>
    <label>${t('dateGiven')}</label>
    <input type="date" id="md-date" value="${existing?existing.date:new Date().toISOString().slice(0,10)}" />
    <label>${t('facilityGiven')}</label>
    <input type="text" id="md-facility" value="${existing?existing.facility||'':''}" placeholder="${LANG==='en'?'e.g. Gandhi Memorial Hospital':'ለምሳሌ ጋንዲ መታሰቢያ ሆስፒታል'}" />
    <label>${t('lotNumber')}</label>
    <input type="text" id="md-lot" value="${existing?existing.lot||'':''}" />
    <div class="modal-actions">
      <button class="btn secondary block" id="md-cancel">${t('cancel')}</button>
      <button class="btn block" id="md-save">${t('markDone')}</button>
    </div>`;
  document.getElementById('md-cancel').onclick = ()=> overlay.classList.remove('active');
  document.getElementById('md-save').onclick = async ()=>{
    doses[v.id] = {
      date: document.getElementById('md-date').value,
      facility: document.getElementById('md-facility').value,
      lot: document.getElementById('md-lot').value
    };
    await saveDoses();
    overlay.classList.remove('active');
    renderAll();
  };
  overlay.classList.add('active');
}

function renderAll(){
  renderHome(); renderCard(); renderCatalog(); renderFacilities(); renderLogTab(); renderQR();
}

function switchLang(lang){
  LANG = lang;
  document.getElementById('lang-en').classList.toggle('active', lang==='en');
  document.getElementById('lang-am').classList.toggle('active', lang==='am');
  applyStaticStrings();
  renderAll();
  saveLang();
}

function switchTab(tabId){
  document.querySelectorAll('main .screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabId));
}

document.querySelectorAll('nav.tabs button').forEach(btn=>{
  btn.onclick = ()=>switchTab(btn.dataset.tab);
});
document.getElementById('lang-en').onclick = ()=>switchLang('en');
document.getElementById('lang-am').onclick = ()=>switchLang('am');
document.getElementById('doseOverlay').onclick = (e)=>{ if(e.target.id==='doseOverlay') e.target.classList.remove('active'); };

document.getElementById('btn-create').onclick = async ()=>{
  const name = document.getElementById('in-name').value.trim();
  const dob = document.getElementById('in-dob').value;
  const sex = document.getElementById('in-sex').value;
  if(!name || !dob){
    alert(LANG==='en' ? 'Please enter a name and date of birth.' : 'እባክዎ ስም እና የትውልድ ቀን ያስገቡ።');
    return;
  }
  profile = {id:'p_'+Date.now(), name, dob, sex};
  profiles.push(profile);
  activeProfileId = profile.id;
  await saveProfiles();
  await saveActiveId();
  await loadProfileData();
  document.getElementById('screen-onboard').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  applyStaticStrings();
  renderAll();
};

// ---- profile switcher ----
function openProfileSwitcher(){
  renderProfileList();
  document.getElementById('profileOverlay').classList.add('active');
}
function renderProfileList(){
  const el = document.getElementById('profile-list');
  el.innerHTML = '';
  profiles.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'profile-row' + (p.id===activeProfileId ? ' active' : '');
    const ageLabel = fmtDate(new Date(p.dob));
    row.innerHTML = `
      <div class="avatar">${initials(p.name)}</div>
      <div class="pinfo">
        <div class="pname">${p.name}${p.id===activeProfileId ? ' · '+t('active') : ''}</div>
        <div class="pmeta">${ageLabel}</div>
      </div>
      <div class="pedit" title="${t('editProfile')}">✎</div>`;
    row.querySelector('.pinfo').onclick = row.querySelector('.avatar').onclick = async ()=>{
      if(activeProfileId === p.id){ document.getElementById('profileOverlay').classList.remove('active'); return; }
      activeProfileId = p.id;
      profile = p;
      await saveActiveId();
      await loadProfileData();
      document.getElementById('profileOverlay').classList.remove('active');
      applyStaticStrings();
      renderAll();
    };
    row.querySelector('.pedit').onclick = (e)=>{ e.stopPropagation(); openProfileForm(p); };
    el.appendChild(row);
  });
}

function openProfileForm(existing){
  document.getElementById('pf-title').textContent = existing ? t('pfTitleEdit') : t('pfTitleAdd');
  document.getElementById('pf-name').value = existing ? existing.name : '';
  document.getElementById('pf-dob').value = existing ? existing.dob : '';
  document.getElementById('pf-sex').value = existing ? existing.sex : 'female';
  document.getElementById('profileFormOverlay').classList.add('active');

  document.getElementById('pf-save').onclick = async ()=>{
    const name = document.getElementById('pf-name').value.trim();
    const dob = document.getElementById('pf-dob').value;
    const sex = document.getElementById('pf-sex').value;
    if(!name || !dob){
      alert(LANG==='en' ? 'Please enter a name and date of birth.' : 'እባክዎ ስም እና የትውልድ ቀን ያስገቡ።');
      return;
    }
    if(existing){
      existing.name = name; existing.dob = dob; existing.sex = sex;
    } else {
      const np = {id:'p_'+Date.now(), name, dob, sex};
      profiles.push(np);
      activeProfileId = np.id;
      profile = np;
      await saveActiveId();
      await loadProfileData();
    }
    await saveProfiles();
    document.getElementById('profileFormOverlay').classList.remove('active');
    document.getElementById('profileOverlay').classList.remove('active');
    applyStaticStrings();
    renderAll();
  };
}

document.getElementById('profileChip').onclick = openProfileSwitcher;
document.getElementById('btn-add-profile').onclick = ()=>openProfileForm(null);
document.getElementById('pf-cancel').onclick = ()=> document.getElementById('profileFormOverlay').classList.remove('active');
document.getElementById('profileOverlay').onclick = (e)=>{ if(e.target.id==='profileOverlay') e.target.classList.remove('active'); };
document.getElementById('profileFormOverlay').onclick = (e)=>{ if(e.target.id==='profileFormOverlay') e.target.classList.remove('active'); };


document.getElementById('btn-log-symptom').onclick = async ()=>{
  const vaccineId = document.getElementById('log-vaccine').value;
  const symptom = document.getElementById('log-symptom').value;
  const severe = SEVERE.has(symptom);
  const resultEl = document.getElementById('triage-result');
  resultEl.innerHTML = `<div class="triage ${severe?'seekcare':'common'}">${severe?t('triageSeek'):t('triageCommon')}</div>`;
  const entry = { vaccineId, symptom, severe, date: new Date().toISOString().slice(0,10) };
  symptomLog.push(entry);
  await saveLog();
  renderLogHistory();
};

document.getElementById('btn-print-cert').onclick = ()=>{
  buildCertificate();
  document.getElementById('certificate').style.display = 'block';
  window.print();
  setTimeout(()=>{ document.getElementById('certificate').style.display = 'none'; }, 500);
};

window.addEventListener('online', ()=>document.getElementById('offlinePill').classList.remove('show'));
window.addEventListener('offline', ()=>document.getElementById('offlinePill').classList.add('show'));

(async function init(){
  await loadAll();
  document.getElementById('lang-en').classList.toggle('active', LANG==='en');
  document.getElementById('lang-am').classList.toggle('active', LANG==='am');
  applyStaticStrings();
  if(profile){
    document.getElementById('screen-onboard').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    renderAll();
  } else {
    document.getElementById('screen-onboard').classList.add('active');
  }
  if(!navigator.onLine) document.getElementById('offlinePill').classList.add('show');
})();

})();
