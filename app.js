// Finally Free Fellowship — app.js

var IMG = {
  "campfire3": "https://i.ibb.co/H9ChYm8/1-B4-A9-B2-A-73-F9-42-E0-8-B5-A-34-CA4510-BA2-B.png",
  "conquerors-reloaded": "https://i.ibb.co/Tx7fS21s/0-BE2-F74-D-C0-A6-4994-9452-F01154-D7152-A.jpg",
  "topic-tuesday": "https://i.ibb.co/3Y52HLGh/signal-2026-03-17-190237.jpg",
  "battle-plan": "https://i.ibb.co/HpFfFd2b/4133448-D-2-ED1-4-F29-A449-B5-DF3-B12-B843.jpg",
  "singapore-cartel": "https://i.ibb.co/fGNpvXwW/4484-F6-DC-CB53-4620-8-DB9-2-DB3-ECECC83-F.jpg",
  "space-capsule": "https://i.ibb.co/NdSxjCMx/9-A83-ECB4-E0-E0-4099-A324-413-A047-BD36-A.jpg",
  "healing-room": "https://i.ibb.co/zWNkBWJg/9-BB66-BB6-514-C-4-CD0-9-E48-FC1-FC18-F996-A.jpg",
  "seventh-tradition": "https://i.ibb.co/0VRnG4vM/8-B1-D082-C-1448-409-E-B7-CB-88-E08-F95-A874.png",
  "thursday-conquerors": "https://i.ibb.co/Z1fvJ1z3/IMG-0139.jpg",
  "thursday-warpath": "https://i.ibb.co/NdrBsJ5d/IMG-0138.jpg",
};
function getImg(id) { return IMG[id] || ""; }

var MEETINGS = [
  {day:"Sunday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Campfire 3 Share",          tagline:"Scripture drill, FASTER check-in, and journaling. An intimate brotherhood discussion.", id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Anthony",        imgId:"campfire3"},
  {day:"Monday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Conquerors Reloaded",       tagline:"Beginners meeting on the video series. No subscription required. All welcome.",          id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Frederick",      imgId:"conquerors-reloaded"},
  {day:"Tuesday",   utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Topic Tuesday Theatre",     tagline:"Member-led discussion on addiction and recovery topics. Real Talk. Real Change.",         id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Jacob",          imgId:"topic-tuesday"},
  {day:"Wednesday", utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Battle Plan for Purity",    tagline:"For committed Conquerors. Regular attendance and homework required.",                    id:"438 456 2619", pw:"Cooljohn",   url:"https://tinyurl.com/Finally-Free-Meeting-2", secretary:"Jared S",        imgId:"battle-plan"},
  {day:"Thursday",  utc:"1:30 PM UTC",  local:"9:30 PM GMT+8 (Singapore)",   name:"The Singapore Cartel",      tagline:"Study the Conquerors series and Big Book. Brotherhood across Asia.",                      id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Nick",           imgId:"singapore-cartel"},
  {day:"Thursday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Thursday Night Conquerors", tagline:"Committed Conquerors group. Regular attendance and homework required.",                  id:"438 456 2619", pw:"Cooljohn",   url:"https://tinyurl.com/Finally-Free-Meeting-2", secretary:"Rusty",          imgId:"thursday-conquerors"},
  {day:"Thursday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Thursday Night Warpath",    tagline:"Advanced Soul Refiners series. Prerequisite: completion of Conquerors.",                id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Morrison",       imgId:"thursday-warpath"},
  {day:"Friday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"The Space Capsule",         tagline:"Speaker disclosures, birthday celebrations, and sobriety chip meetings.",               id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"John K",         imgId:"space-capsule"},
  {day:"Saturday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"The Healing Room",          tagline:"Trauma. The ten worst and secrets. Therapy-themed healing. You are safe here.",         id:"813 140 1905", pw:"freeIndeed", url:"https://tinyurl.com/Finally-Free-Meeting",   secretary:"Wayne",          imgId:"healing-room"}
];

var customMeetings = [];
try { customMeetings = JSON.parse(localStorage.getItem("ff_custom_meetings")||"[]"); } catch(e) {}

function renderMeetings(filter) {
  var grid = document.getElementById("meetingsGrid");
  if (!grid) return;
  var all  = MEETINGS.concat(customMeetings);
  var data = (!filter || filter==="all") ? all : all.filter(function(m){ return m.day===filter; });
  var html = "";
  for (var i = 0; i < data.length; i++) {
    var m      = data[i];
    var imgSrc = m.isCustom ? (m.imgUrl||"") : getImg(m.imgId);
    var imgHtml = imgSrc
      ? '<img class="m-art" src="'+imgSrc+'" alt="'+m.name+'" loading="lazy">'
      : '<div class="m-art" style="background:linear-gradient(135deg,#0d2244,#1a3a6b);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">&#9876;</div>';
    var badge  = m.isCustom ? ' <span style="font-size:.44rem;background:rgba(201,151,58,.18);border:1px solid rgba(201,151,58,.3);padding:.1rem .35rem;border-radius:2px;vertical-align:middle;">CUSTOM</span>' : '';
    var delBtn = m.isCustom ? '<button onclick="deleteCustomMeeting('+JSON.stringify(m.customId)+')" class="copy-btn" style="color:rgba(220,80,80,.7);border-color:rgba(220,80,80,.3);">Remove</button>' : '';
    var cid    = JSON.stringify(m.id);
    var cpw    = JSON.stringify(m.pw);
    html += '<div class="m-card">'
      +'<div class="m-art-wrap">'+imgHtml+'<div class="m-art-overlay"></div></div>'
      +'<div class="m-body">'
      +'<div class="m-day">'+m.day+badge+'</div>'
      +'<div class="m-name">'+m.name+'</div>'
      +'<div class="m-tagline">'+m.tagline+'</div>'
      +'<div class="m-detail"><span>&#128336;</span><span>'+m.utc+' &middot; '+m.local+'</span></div>'
      +'<div class="m-detail"><span>&#128203;</span><span>ID: '+m.id+' &middot; PW: <strong style="color:var(--gold-pale)">'+m.pw+'</strong></span></div>'
      +'<div class="m-detail"><span>&#128100;</span><span>Secretary: '+m.secretary+'</span></div>'
      +'<div class="m-actions">'
      +'<a href="'+m.url+'" target="_blank" class="join-btn">Join Zoom &rarr;</a>'
      +'<button class="copy-btn" onclick="copyInfo('+cid+','+cpw+')">Copy Info</button>'
      +delBtn
      +'</div></div></div>';
  }
  grid.innerHTML = html || '<p style="color:var(--gray);font-style:italic;padding:1rem 0;">No meetings on this day.</p>';
}

function filterDay(day, btn) {
  var btns = document.querySelectorAll(".day-btn");
  for (var i=0; i<btns.length; i++) btns[i].classList.remove("active");
  btn.classList.add("active");
  renderMeetings(day==="All"?"all":day);
}

function copyInfo(id, pw) {
  navigator.clipboard.writeText("Meeting ID: "+id+"\nPassword: "+pw)
    .then(function(){ showToast("Copied!"); })
    .catch(function(){ showToast("ID: "+id+" / PW: "+pw); });
}

function openAddMeetingModal()  { var m=document.getElementById("addMeetingModal"); if(m) m.classList.add("open"); }
function closeAddMeetingModal() {
  var m=document.getElementById("addMeetingModal"); if(m) m.classList.remove("open");
  ["amName","amUtc","amLocal","amId","amPw","amUrl","amSecretary","amTagline"].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value="";
  });
}
function saveCustomMeeting() {
  var name = document.getElementById("amName").value.trim();
  if (!name) { showToast("Meeting name is required."); return; }
  customMeetings.push({
    customId:  "cm_"+Date.now(),
    isCustom:  true,
    day:       document.getElementById("amDay").value,
    utc:       document.getElementById("amUtc").value.trim()       || "See Zoom link",
    local:     document.getElementById("amLocal").value.trim()     || "",
    name:      name,
    tagline:   document.getElementById("amTagline").value.trim()   || "",
    id:        document.getElementById("amId").value.trim()        || "—",
    pw:        document.getElementById("amPw").value.trim()        || "",
    url:       document.getElementById("amUrl").value.trim()       || "https://zoom.us",
    secretary: document.getElementById("amSecretary").value.trim() || "—",
    imgUrl:    ""
  });
  localStorage.setItem("ff_custom_meetings", JSON.stringify(customMeetings));
  closeAddMeetingModal();
  var btn = document.querySelector(".day-btn.active");
  var dayMap = {"All":"all","Sun":"Sunday","Mon":"Monday","Tue":"Tuesday","Wed":"Wednesday","Thu":"Thursday","Fri":"Friday","Sat":"Saturday"};
  renderMeetings(btn ? (dayMap[btn.textContent.trim()]||"all") : "all");
  showToast(name+" added!");
}
function deleteCustomMeeting(cid) {
  customMeetings = customMeetings.filter(function(m){ return m.customId!==cid; });
  localStorage.setItem("ff_custom_meetings", JSON.stringify(customMeetings));
  var btn = document.querySelector(".day-btn.active");
  var dayMap = {"All":"all","Sun":"Sunday","Mon":"Monday","Tue":"Tuesday","Wed":"Wednesday","Thu":"Thursday","Fri":"Friday","Sat":"Saturday"};
  renderMeetings(btn ? (dayMap[btn.textContent.trim()]||"all") : "all");
  showToast("Meeting removed.");
}

var D21 = [
  {num:1,  turnIn:false, title:"Morning and Evening Prayer",         desc:"Pray each morning asking God for 1 day of sobriety. At night thank Him for getting you through. Do this with your AP 3 times a week."},
  {num:2,  turnIn:false, title:"Clear Home of Porn and Triggers",    desc:"Remove all pornographic and suggestive material from your home. Have your AP on the phone with you during this."},
  {num:3,  turnIn:false, title:"Join the FF Signal Group",           desc:"Request and join the Finally Free Signal group. Download all members phone numbers to your phone. This is a MUST."},
  {num:4,  turnIn:false, title:"Download All Members Numbers",       desc:"A list of all FF members has been provided. Save every Signal phone number to your phone."},
  {num:5,  turnIn:false, title:"Install Accountability Software",    desc:"Install accountability software on ALL devices with at least 3 allies. Ask in Signal if anyone has space in their family plans."},
  {num:6,  turnIn:false, title:"Bookmark the FF Meeting Flyer",      desc:"Download the FF Meeting Flyer and mark it for easy access. Sign into one meeting to verify it works."},
  {num:7,  turnIn:false, title:"Obtain Recovery Materials",          desc:"Get copies of: AA Big Book, AA 12 Steps and 12 Traditions, SA White Book, SA Step into Action."},
  {num:8,  turnIn:true,  title:"Summarize Steps 1, 2 and 3",        desc:"Read Steps 1-3 from AA 12 Steps and 12 Traditions. Write one page of reflections per step. Share with your AP and FF group."},
  {num:9,  turnIn:false, title:"Bookmark the NextMeeting Link",      desc:"Open the NextMeeting link and bookmark it on all browsers. Use it to find 24/7 SA meetings happening right now around the world."},
  {num:10, turnIn:true,  title:"Begin 90 Meetings in 90 Days",       desc:"Start your 90-in-90 and document every meeting with date, location, and notes. Only SA and Conquerors or FF meetings count."},
  {num:11, turnIn:true,  title:"Record Your Journey",                desc:"On a document titled My Program, begin cataloging things you heard in meetings that you want to implement to stay sober."},
  {num:12, turnIn:false, title:"Commit to a Service Position",       desc:"Find an ongoing service position in FF or an SA meeting. Doing something once is not being in service."},
  {num:13, turnIn:false, title:"30 Days of Fishing Prayer",          desc:"For 30 days pray for God to use you to help rescue one man from addiction. Do not stop until He answers."},
  {num:14, turnIn:true,  title:"Write a Time Commitment Statement",  desc:"How will you prioritize your program and recovery above everything else? Present it to your group."},
  {num:15, turnIn:true,  title:"Write a Plan to Help Others",        desc:"How will you help others in the short and long term? Think big. Read it to the group."},
  {num:16, turnIn:true,  title:"How You Will Help Your AP",          desc:"Write out how you are going to help your accountability partner get and stay sober. Present to your group."},
  {num:17, turnIn:false, title:"Obtain an Accountability Partner",   desc:"Find an AP who talks with you daily. Have them read their items 14, 15, and 16 to you before choosing them."},
  {num:18, turnIn:false, title:"Get an SA Sponsor",                  desc:"Obtain an SA sponsor or Temporary Sponsor by completion of 90 days. They must cooperate with the Conquerors curriculum."},
  {num:19, turnIn:false, title:"Find Someone You Are Sponsoring",    desc:"Within 90 days find someone you are sponsoring and working with intensely to help them get free."},
  {num:20, turnIn:false, title:"AP Review of All 21",                desc:"Have your AP go over all 21 with you looking for holes. You must also go over their 21. Then meet with a leader to review."},
  {num:21, turnIn:true,  title:"Final Certification",                desc:"Turn all materials in to your leader. Complete the Detox-21, receive final enrollment, and begin Conquerors."}
];

var d21Profile = null, d21State = {}, d21Notes = {};
try { d21Profile = JSON.parse(localStorage.getItem("ff_d21_profile")||"null"); } catch(e) {}
try { d21State   = JSON.parse(localStorage.getItem("ff_d21")        ||"{}");   } catch(e) {}
try { d21Notes   = JSON.parse(localStorage.getItem("ff_d21_notes")  ||"{}");   } catch(e) {}

function enrollD21() {
  var name=document.getElementById("d21Name").value.trim();
  var start=document.getElementById("d21StartDate").value;
  var ap=document.getElementById("d21APName").value.trim();
  if (!name||!start) { showToast("Enter your name and start date."); return; }
  d21Profile={name:name,start:start,ap:ap};
  localStorage.setItem("ff_d21_profile",JSON.stringify(d21Profile));
  showD21Main();
}
function showD21Main() {
  var ew=document.getElementById("d21EnrollWrap"), mw=document.getElementById("d21MainWrap");
  if(ew) ew.style.display="none"; if(mw) mw.style.display="block";
  var nd=document.getElementById("d21NameDisplay"),  ad=document.getElementById("d21APDisplay"),  sd=document.getElementById("d21StartDisplay");
  if(nd) nd.textContent=d21Profile.name;
  if(ad) ad.textContent=d21Profile.ap||"Not yet set";
  if(sd) sd.textContent=new Date(d21Profile.start+"T12:00:00").toLocaleDateString();
  renderD21List(); updateD21Stats();
}
function renderD21List() {
  var list=document.getElementById("d21List"); if(!list) return;
  var html="";
  for (var i=0;i<D21.length;i++) {
    var item=D21[i], done=!!d21State[item.num], note=d21Notes[item.num]||"";
    var badges=(done?'<span class="badge badge-green">&#10003; Complete</span>':'')+
               (item.turnIn?' <span class="badge badge-gold">Turn In</span>':'');
    html+='<div class="d21-item'+(done?" completed":"")+'" id="d21item-'+item.num+'">'
      +'<div class="d21-item-row">'
      +'<div class="d21-check'+(done?" done":"")+'" onclick="toggleD21('+item.num+')">'+(done?"&#10003;":"")+'</div>'
      +'<div class="d21-num">#'+item.num+'</div>'
      +'<div class="d21-body">'
      +'<div class="d21-title">'+item.title+'</div>'
      +'<div class="d21-desc">'+item.desc+'</div>'
      +'<div class="d21-badges">'+badges+'</div>'
      +'<button class="d21-notes-btn" onclick="toggleD21Notes('+item.num+',this)">'+(note?"▼ Notes":"▶ Add notes")+'</button>'
      +'<div class="d21-notes-wrap"><textarea class="d21-notes-input" id="d21note-'+item.num+'" placeholder="Notes, reflections..." onblur="saveD21Note('+item.num+')">'+note+'</textarea></div>'
      +'</div></div></div>';
  }
  list.innerHTML=html;
}
function toggleD21(num) {
  d21State[num]=!d21State[num];
  localStorage.setItem("ff_d21",JSON.stringify(d21State));
  renderD21List(); updateD21Stats();
  showToast(d21State[num]?"Item "+num+" complete!":"Item "+num+" unchecked");
}
function toggleD21Notes(num,btn) {
  var item=document.getElementById("d21item-"+num); if(!item) return;
  item.classList.toggle("expanded");
  var note=d21Notes[num]||"";
  btn.textContent=item.classList.contains("expanded")?"Hide notes":(note?"Notes":"Add notes");
}
function saveD21Note(num) {
  var el=document.getElementById("d21note-"+num); if(!el) return;
  d21Notes[num]=el.value; localStorage.setItem("ff_d21_notes",JSON.stringify(d21Notes));
  var btn=document.querySelector("#d21item-"+num+" .d21-notes-btn");
  if(btn) btn.textContent=el.value?"Notes":"Add notes";
}
function updateD21Stats() {
  var done=0; for(var k in d21State){if(d21State[k])done++;}
  var pct=Math.round(done/21*100);
  var el;
  el=document.getElementById("d21StatDone");  if(el) el.textContent=done;
  el=document.getElementById("d21StatLeft");  if(el) el.textContent=21-done;
  el=document.getElementById("d21StatPct");   if(el) el.textContent=pct+"%";
  el=document.getElementById("d21ProgFill");  if(el) el.style.width=pct+"%";
  el=document.getElementById("d21PctText");   if(el) el.textContent=pct+"%";
  el=document.getElementById("d21Circle");    if(el) el.style.strokeDashoffset=(263.9*(1-done/21)).toFixed(2);
}
function resetD21() {
  if(!confirm("Reset your Detox-21?")) return;
  d21State={}; d21Notes={}; d21Profile=null;
  localStorage.removeItem("ff_d21"); localStorage.removeItem("ff_d21_notes"); localStorage.removeItem("ff_d21_profile");
  var ew=document.getElementById("d21EnrollWrap"), mw=document.getElementById("d21MainWrap");
  if(ew) ew.style.display="block"; if(mw) mw.style.display="none";
  showToast("Detox-21 reset.");
}
function exportD21() {
  if(!d21Profile) return;
  var done=0; for(var k in d21State){if(d21State[k])done++;}
  var lines=["FINALLY FREE - DETOX-21","Name: "+d21Profile.name,"AP: "+(d21Profile.ap||"Not set"),"Started: "+d21Profile.start,""];
  for(var i=0;i<D21.length;i++){
    var item=D21[i];
    lines.push((d21State[item.num]?"[x]":"[ ]")+" #"+item.num+" - "+item.title+(item.turnIn?" (TURN IN)":"")+(d21Notes[item.num]?"\n    "+d21Notes[item.num]:""));
  }
  lines.push("","Progress: "+done+"/21 ("+Math.round(done/21*100)+"%)");
  download("FF-Detox21.txt",lines.join("\n"));
}

var n90Data=null, logEntries=[];
try { n90Data=JSON.parse(localStorage.getItem("ff_90in90")||"null"); } catch(e) {}
try { logEntries=JSON.parse(localStorage.getItem("ff_90log")||"[]"); } catch(e) {}

function switchN90(panel,btn) {
  document.querySelectorAll("#n90Tabs .tab").forEach(function(t){t.classList.remove("active");});
  document.querySelectorAll("#ninety-section .tab-panel").forEach(function(p){p.classList.remove("active");});
  btn.classList.add("active");
  document.getElementById("n90-"+panel).classList.add("active");
  if(panel==="leaderboard") loadLeaderboard();
  if(panel==="log") renderLogTable();
}
function enroll90() {
  var name=document.getElementById("e90Name").value.trim();
  var start=document.getElementById("e90Start").value;
  if(!name||!start){showToast("Enter your name and start date.");return;}
  n90Data={name:name,start:start};
  localStorage.setItem("ff_90in90",JSON.stringify(n90Data));
  renderProgress(); submitLeaderboard(name,logEntries.length);
}
function resetN90() {
  if(!confirm("Reset enrollment? Your log will be kept.")) return;
  localStorage.removeItem("ff_90in90"); n90Data=null;
  var ew=document.getElementById("enrollFormWrap"), pw=document.getElementById("progressWrap");
  if(ew) ew.style.display="block"; if(pw) pw.style.display="none";
}
function renderProgress() {
  if(!n90Data) return;
  var ew=document.getElementById("enrollFormWrap"), pw=document.getElementById("progressWrap");
  if(ew) ew.style.display="none"; if(pw) pw.style.display="block";
  var done=logEntries.length, pct=Math.min(100,Math.round(done/90*100));
  var el;
  el=document.getElementById("pb-name");     if(el) el.textContent=n90Data.name;
  el=document.getElementById("stat-done");   if(el) el.textContent=done;
  el=document.getElementById("stat-left");   if(el) el.textContent=Math.max(0,90-done);
  el=document.getElementById("stat-streak"); if(el) el.textContent=calcStreak();
  el=document.getElementById("pct-text");    if(el) el.textContent=pct+"%";
  el=document.getElementById("progressCircle"); if(el) el.style.strokeDashoffset=(301.6*(1-done/90)).toFixed(2);
  var s=new Date(n90Data.start+"T12:00:00"), t=new Date(s.getTime()+89*86400000);
  el=document.getElementById("pb-start");  if(el) el.textContent=s.toLocaleDateString();
  el=document.getElementById("pb-target"); if(el) el.textContent=t.toLocaleDateString();
}
function calcStreak() {
  if(!logEntries.length) return 0;
  var dates={};
  logEntries.forEach(function(e){dates[e.date]=true;});
  var streak=0, d=new Date();
  for(var i=0;i<90;i++){
    if(dates[d.toISOString().split("T")[0]]){streak++;d.setDate(d.getDate()-1);}
    else break;
  }
  return streak;
}
function addLogEntry() {
  if(!n90Data){showToast("Enroll first in the My Progress tab.");return;}
  var num=parseInt(document.getElementById("logNum").value)||logEntries.length+1;
  var date=document.getElementById("logDate").value;
  var loc=document.getElementById("logLoc").value.trim();
  var notes=document.getElementById("logNotes").value.trim();
  if(!date||!loc){showToast("Date and location are required.");return;}
  var filtered=logEntries.filter(function(e){return e.num!==num;});
  filtered.push({num:num,date:date,loc:loc,notes:notes,id:Date.now()});
  filtered.sort(function(a,b){return a.num-b.num;});
  logEntries=filtered;
  localStorage.setItem("ff_90log",JSON.stringify(logEntries));
  renderLogTable(); renderProgress(); submitLeaderboard(n90Data.name,logEntries.length);
  document.getElementById("logLoc").value=""; document.getElementById("logNotes").value="";
  document.getElementById("logNum").value=logEntries.length+1;
  showToast("Meeting #"+num+" logged!");
}
function deleteLog(id) {
  logEntries=logEntries.filter(function(e){return e.id!==id;});
  localStorage.setItem("ff_90log",JSON.stringify(logEntries));
  renderLogTable(); renderProgress();
}
function renderLogTable() {
  var tbody=document.getElementById("logTableBody"), empty=document.getElementById("logEmpty"), count=document.getElementById("logCount");
  if(count) count.textContent=logEntries.length+" of 90 meetings logged";
  var numEl=document.getElementById("logNum"); if(numEl) numEl.value=logEntries.length+1;
  if(!logEntries.length){if(tbody) tbody.innerHTML=""; if(empty) empty.style.display="block"; return;}
  if(empty) empty.style.display="none";
  tbody.innerHTML=logEntries.map(function(e){
    var d=new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"});
    return "<tr><td class='log-day-num'>#"+e.num+"</td><td>"+d+"</td><td>"+(e.loc||"")+"</td>"
      +"<td style='max-width:180px;word-break:break-word;'>"+(e.notes||"&mdash;")+"</td>"
      +"<td><button onclick='deleteLog("+e.id+")' style='background:none;border:none;color:rgba(138,155,181,.3);cursor:pointer;font-size:.85rem;' onmouseover='this.style.color="#c0392b"' onmouseout='this.style.color="rgba(138,155,181,.3)"'>&#10005;</button></td></tr>";
  }).join("");
}
function exportLog() {
  var lines=["FINALLY FREE - 90-IN-90 LOG","Name: "+(n90Data?n90Data.name:""),"Start: "+(n90Data?n90Data.start:""),"Generated: "+new Date().toLocaleDateString(),""];
  logEntries.forEach(function(e){
    lines.push(("  "+e.num).slice(-3)+"  "+new Date(e.date+"T12:00:00").toLocaleDateString()+"  "+(e.loc||"")+"  "+(e.notes||""));
  });
  lines.push("","Total: "+logEntries.length+"/90");
  download("FF-90in90-Log.txt",lines.join("\n"));
}
async function submitLeaderboard(name,count) {
  try { var b={}; try{var r=await window.storage.get("ff_leaderboard",true);if(r&&r.value)b=JSON.parse(r.value);}catch(e){} b[name]=count; await window.storage.set("ff_leaderboard",JSON.stringify(b),true); } catch(e) {}
}
async function loadLeaderboard() {
  var el=document.getElementById("leaderboardList"); if(!el) return;
  el.innerHTML="<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>Loading...</p>";
  try {
    var res=await window.storage.get("ff_leaderboard",true);
    if(!res||!res.value){el.innerHTML="<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>No brothers enrolled yet.</p>";return;}
    var board=JSON.parse(res.value); if(n90Data) board[n90Data.name]=logEntries.length;
    var sorted=Object.entries(board).sort(function(a,b){return b[1]-a[1];});
    el.innerHTML=sorted.map(function(entry,i){
      var bname=entry[0],bcount=entry[1],pct=Math.min(100,Math.round(bcount/90*100));
      var medal=["1st","2nd","3rd"][i]||(i+1)+"th";
      return "<div class='lb-row'><div class='lb-rank'>"+medal+"</div><div class='lb-name'>"+bname+"</div>"
        +"<div style='display:flex;align-items:center;gap:.6rem;'><div class='lb-bar-wrap'><div class='lb-bar' style='width:"+pct+"%'></div></div>"
        +"<div class='lb-count'>"+bcount+"/90 ("+pct+"%)</div></div></div>";
    }).join("") || "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>No data yet.</p>";
  } catch(e) { el.innerHTML="<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>Board unavailable.</p>"; }
}

var journalEntries=[];
try { journalEntries=JSON.parse(localStorage.getItem("ff_journal")||"[]"); } catch(e) {}

function handleMeetingSelect() {
  var val=document.getElementById("jMeeting").value;
  var wrap=document.getElementById("otherMeetingWrap");
  if(wrap) wrap.className="other-wrap"+(val==="__other__"?" show":"");
}
function addJournalEntry() {
  var sel=document.getElementById("jMeeting").value;
  var meeting=sel==="__other__"?document.getElementById("otherMeeting").value.trim():sel;
  if(sel==="__other__"&&!meeting){showToast("Enter the meeting name.");return;}
  var date=document.getElementById("jDate").value;
  var mood=document.getElementById("jMood").value;
  var notes=document.getElementById("jNotes").value.trim();
  var insight=document.getElementById("jInsight").value.trim();
  if(!meeting||!date||!notes){showToast("Select a meeting, add a date and notes.");return;}
  journalEntries.unshift({id:Date.now(),meeting:meeting,date:date,mood:mood,notes:notes,insight:insight,isOther:(sel==="__other__")});
  localStorage.setItem("ff_journal",JSON.stringify(journalEntries));
  renderJournal();
  document.getElementById("jMeeting").value="";
  document.getElementById("otherMeeting").value="";
  var ow=document.getElementById("otherMeetingWrap"); if(ow) ow.className="other-wrap";
  document.getElementById("jNotes").value=""; document.getElementById("jInsight").value="";
  showToast("Journal entry saved!");
}
function deleteJEntry(id) {
  journalEntries=journalEntries.filter(function(e){return e.id!==id;});
  localStorage.setItem("ff_journal",JSON.stringify(journalEntries)); renderJournal();
}
function renderJournal() {
  var filter=document.getElementById("jFilter").value;
  var entries=journalEntries;
  if(filter==="__other__") entries=journalEntries.filter(function(e){return e.isOther;});
  else if(filter!=="all")  entries=journalEntries.filter(function(e){return e.meeting===filter;});
  var countEl=document.getElementById("journalCount");
  if(countEl) countEl.textContent=journalEntries.length+(journalEntries.length===1?" entry":" entries");
  var el=document.getElementById("journalEntries"); if(!el) return;
  if(!entries.length){el.innerHTML="<p class='j-empty'>No entries yet.</p>";return;}
  el.innerHTML=entries.map(function(e){
    var d=new Date(e.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
    var notesHtml=e.notes?e.notes.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>"):"";
    return "<div class='j-entry'>"
      +"<div class='j-entry-header'><div><div class='j-meeting-name'>"+e.meeting+"</div><div class='j-entry-date'>"+d+"</div></div>"
      +"<div style='display:flex;align-items:center;gap:.4rem;'><span style='font-size:1rem;background:rgba(201,151,58,.12);padding:.2rem .5rem;border-radius:3px;'>"+e.mood+"</span>"
      +"<button class='j-delete' onclick='deleteJEntry("+e.id+")'>&#10005;</button></div></div>"
      +"<div class='j-entry-text'>"+notesHtml+"</div>"
      +(e.insight?"<div class='j-entry-insight'><span>Key insight:</span> "+e.insight+"</div>":"")
      +"</div>";
  }).join("");
}

var mapMembers=[];
async function loadMapMembers() {
  try{var r=await window.storage.get("ff_brotherhood_map",true);if(r&&r.value)mapMembers=JSON.parse(r.value);}
  catch(e){try{var l=localStorage.getItem("ff_brotherhood_map");if(l)mapMembers=JSON.parse(l);}catch(e2){}}
  renderMap();
}
async function saveMapMembers() {
  var json=JSON.stringify(mapMembers);
  try{await window.storage.set("ff_brotherhood_map",json,true);}
  catch(e){try{localStorage.setItem("ff_brotherhood_map",json);}catch(e2){}}
}
function geoToSVG(lat,lng){
  var x=(lng+180)*(1000/360);
  var mercN=Math.log(Math.tan(Math.PI/4+(lat*Math.PI/180)/2));
  var y=250-(500*mercN/(2*Math.PI));
  return{x:Math.max(5,Math.min(995,x)),y:Math.max(5,Math.min(495,y))};
}
function renderMap(){
  document.querySelectorAll(".member-dot").forEach(function(d){d.remove();});
  var svg=document.getElementById("world-map");
  var list=document.getElementById("membersList");
  var badge=document.getElementById("memberCountBadge");
  if(!svg) return;
  mapMembers.forEach(function(m,idx){
    var pos=geoToSVG(m.lat,m.lng);
    var g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute("class","member-dot");
    g.setAttribute("transform","translate("+pos.x.toFixed(1)+","+pos.y.toFixed(1)+")");
    var pulse=document.createElementNS("http://www.w3.org/2000/svg","circle");
    pulse.setAttribute("r","7"); pulse.setAttribute("fill","rgba(201,151,58,.2)");
    pulse.style.animation="ping 2s ease-out "+((idx*.4)%2)+"s infinite";
    pulse.style.transformOrigin="center";
    var dot=document.createElementNS("http://www.w3.org/2000/svg","circle");
    dot.setAttribute("r","4.5"); dot.setAttribute("fill","#c9973a");
    dot.setAttribute("stroke","#f5dfa0"); dot.setAttribute("stroke-width","1.5");
    g.appendChild(pulse); g.appendChild(dot); svg.appendChild(g);
    g.addEventListener("mouseenter",function(){
      var tt=document.getElementById("mapTooltip"), con=document.querySelector(".map-wrap");
      if(!tt||!con) return;
      document.getElementById("ttName").textContent=m.name;
      document.getElementById("ttLoc").textContent=m.city+(m.country?", "+m.country:"");
      document.getElementById("ttContact").textContent=m.contact||"";
      tt.style.display="block";
      var cr=con.getBoundingClientRect(),gr=g.getBoundingClientRect();
      var left=gr.left-cr.left+12, top=gr.top-cr.top-75;
      if(left+200>cr.width) left-=210; if(top<5) top=gr.top-cr.top+15;
      tt.style.left=left+"px"; tt.style.top=top+"px";
    });
    g.addEventListener("mouseleave",function(){
      var tt=document.getElementById("mapTooltip"); if(tt) tt.style.display="none";
    });
  });
  if(badge) badge.textContent=mapMembers.length+(mapMembers.length===1?" brother":" brothers")+" on the map";
  if(list) list.innerHTML=mapMembers.length?mapMembers.map(function(m){
    return "<div class='member-pill'><div class='mp-name'>"+m.name+"</div><div class='mp-loc'>"+m.city+(m.country?", "+m.country:"")+"</div>"+(m.contact?"<div class='mp-contact'>"+m.contact+"</div>":"")+"</div>";
  }).join(""):"<p style='font-size:.8rem;color:var(--gray);font-style:italic;padding:1rem 0;'>Be the first to place your pin, brother.</p>";
}
function openMapModal(){var m=document.getElementById("mapModal");if(m)m.classList.add("open");}
function closeMapModal(){var m=document.getElementById("mapModal");if(m)m.classList.remove("open");}
async function submitMember(){
  var name=document.getElementById("mName").value.trim();
  var city=document.getElementById("mCity").value.trim();
  var country=document.getElementById("mCountry").value.trim();
  var contact=document.getElementById("mContact").value.trim();
  var lat=parseFloat(document.getElementById("mLat").value);
  var lng=parseFloat(document.getElementById("mLng").value);
  if(!name||!city||isNaN(lat)||isNaN(lng)){showToast("Fill in name, city, and coordinates.");return;}
  mapMembers.push({name:name,city:city,country:country,contact:contact,lat:lat,lng:lng,added:Date.now()});
  await saveMapMembers(); renderMap(); closeMapModal();
  showToast("Pin placed! Welcome to the map.");
  ["mName","mCity","mCountry","mContact","mLat","mLng"].forEach(function(id){document.getElementById(id).value="";});
}

function initApp() {
  var today=new Date().toISOString().split("T")[0];
  ["d21StartDate","logDate","e90Start","jDate"].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value=today;
  });
  renderMeetings("all");
  if(d21Profile) showD21Main();
  if(n90Data) renderProgress();
  renderLogTable();
  renderJournal();
  loadMapMembers();
  var modal=document.getElementById("mapModal");
  if(modal) modal.addEventListener("click",function(e){if(e.target===this)closeMapModal();});
  var amModal=document.getElementById("addMeetingModal");
  if(amModal) amModal.addEventListener("click",function(e){if(e.target===this)closeAddMeetingModal();});
}
if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",initApp);
} else { initApp(); }

function showToast(msg){
  var t=document.getElementById("toast"); if(!t) return;
  t.innerHTML=msg; t.classList.add("show");
  setTimeout(function(){t.classList.remove("show");},3500);
}
function download(filename,text){
  var a=document.createElement("a");
  a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(text);
  a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// Global exports
window.filterDay=filterDay; window.copyInfo=copyInfo;
window.enrollD21=enrollD21; window.toggleD21=toggleD21;
window.toggleD21Notes=toggleD21Notes; window.saveD21Note=saveD21Note;
window.resetD21=resetD21; window.exportD21=exportD21;
window.switchN90=switchN90; window.enroll90=enroll90; window.resetN90=resetN90;
window.addLogEntry=addLogEntry; window.deleteLog=deleteLog; window.exportLog=exportLog;
window.addJournalEntry=addJournalEntry; window.deleteJEntry=deleteJEntry; window.renderJournal=renderJournal;
window.handleMeetingSelect=handleMeetingSelect;
window.openMapModal=openMapModal; window.closeMapModal=closeMapModal; window.submitMember=submitMember;
window.openAddMeetingModal=openAddMeetingModal; window.closeAddMeetingModal=closeAddMeetingModal;
window.saveCustomMeeting=saveCustomMeeting; window.deleteCustomMeeting=deleteCustomMeeting;
