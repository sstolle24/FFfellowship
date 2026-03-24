
// Images loaded from hidden DOM img elements - no base64 in JS strings
var IMG = {
  "img-campfire3":           "images/campfire3.jpg",
  "img-conquerors-reloaded": "images/conquerors-reloaded.jpg",
  "img-topic-tuesday":       "images/topic-tuesday.jpg",
  "img-battle-plan":         "images/battle-plan.jpg",
  "img-singapore-cartel":    "images/singapore-cartel.jpg",
  "img-space-capsule":       "images/space-capsule.jpg",
  "img-healing-room":        "images/healing-room.jpg",
  "img-seventh-tradition":   "images/seventh-tradition.png"
};

function getImg(id) { return IMG[id] || ""; }

// ── MEETINGS ──
var MEETINGS = [
  {day:"Sunday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Campfire 3 Share",           tagline:"Scripture drill, FASTER check-in, and journaling. An intimate brotherhood discussion.", id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Anthony",   imgId:"img-campfire3"},
  {day:"Monday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Conquerors Reloaded",        tagline:"Beginners meeting on the video series. No subscription required. All welcome.",          id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Frederick", imgId:"img-conquerors-reloaded"},
  {day:"Tuesday",   utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Topic Tuesday Theatre",      tagline:"Member-led discussion on addiction and recovery topics. Real Talk. Real Change.",         id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Jacob",     imgId:"img-topic-tuesday"},
  {day:"Wednesday", utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Battle Plan for Purity",     tagline:"For committed Conquerors. Regular attendance and homework required.",                    id:"438 456 2619", pw:"Cooljohn",   room:2, secretary:"Jared S",   imgId:"img-battle-plan"},
  {day:"Thursday",  utc:"1:30 PM UTC",  local:"9:30 PM GMT+8 (Singapore)",    name:"The Singapore Cartel",       tagline:"Study the Conquers series and Big Book. Brotherhood across Asia.",                       id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Nick",       imgId:"img-singapore-cartel"},
  {day:"Thursday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Thursday Night Conquerors",  tagline:"Committed Conquerors group. Regular attendance and homework required.",                  id:"438 456 2619", pw:"Cooljohn",   room:2, secretary:"Rusty",      imgId:"img-battle-plan"},
  {day:"Thursday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"Thursday Night Warpath",     tagline:"Advanced Soul Refiners series. Prerequisite: completion of Conquers.",                  id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Morrison",   imgId:"img-battle-plan"},
  {day:"Friday",    utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"The Space Capsule",          tagline:"Speaker disclosures, birthday celebrations, and sobriety chip meetings.",               id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"John K",    imgId:"img-space-capsule"},
  {day:"Saturday",  utc:"12:00 AM UTC", local:"5 PM Pacific / 8 PM Eastern", name:"The Healing Room",           tagline:"Trauma. The ten worst and secrets. Therapy-themed healing. You are safe here.",         id:"813 140 1905", pw:"freeIndeed", room:1, secretary:"Wayne",      imgId:"img-healing-room"}
];
var ROOM_URLS = {1:"https://tinyurl.com/Finally-Free-Meeting", 2:"https://tinyurl.com/Finally-Free-Meeting-2"};

function renderMeetings(filter) {
  var grid = document.getElementById("meetingsGrid");
  var data = (!filter || filter === "all") ? MEETINGS : MEETINGS.filter(function(m){ return m.day === filter; });
  var html = "";
  for (var i = 0; i < data.length; i++) {
    var m = data[i];
    var src = getImg(m.imgId);
    html += '<div class="m-card">'
      + '<div class="m-art-wrap"><img class="m-art" src="' + src + '" alt="' + m.name + '" loading="lazy"><div class="m-art-overlay"></div></div>'
      + '<div class="m-body">'
      + '<div class="m-day">' + m.day + '</div>'
      + '<div class="m-name">' + m.name + '</div>'
      + '<div class="m-tagline">' + m.tagline + '</div>'
      + '<div class="m-detail"><span>&#128336;</span><span>' + m.utc + ' &middot; ' + m.local + '</span></div>'
      + '<div class="m-detail"><span>&#128203;</span><span>ID: ' + m.id + ' &middot; PW: <strong style="color:var(--gold-pale)">' + m.pw + '</strong></span></div>'
      + '<div class="m-detail"><span>&#128100;</span><span>Secretary: ' + m.secretary + ' &middot; Room ' + m.room + '</span></div>'
      + '<div class="m-actions">'
      + '<a href="' + ROOM_URLS[m.room] + '" target="_blank" class="join-btn">Join Zoom &rarr;</a>'
      + '<button class="copy-btn" onclick="copyInfo(\'' + m.id + '\',\'' + m.pw + '\')">Copy Info</button>'
      + '</div></div></div>';
  }
  grid.innerHTML = html;
}
function filterDay(day, btn) {
  var btns = document.querySelectorAll(".day-btn");
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
  btn.classList.add("active");
  renderMeetings(day);
}
function copyInfo(id, pw) {
  navigator.clipboard.writeText("Meeting ID: " + id + "\nPassword: " + pw).then(function(){ showToast("Copied!"); });
}

// ── DETOX-21 DATA ──
var D21 = [
  {num:1,  turnIn:false, title:"Morning and Evening Prayer",          desc:"Pray each morning asking God for 1 day of sobriety. Each night thank Him for getting you through. Do this with your AP 3 times a week."},
  {num:2,  turnIn:false, title:"Clear Home of Porn and Triggers",     desc:"Remove all pornographic and suggestive material from your home. Have a buddy on the phone with you during this."},
  {num:3,  turnIn:false, title:"Join the FF Signal Group",            desc:"Request and join the Finally Free Signal group. Download all members phone numbers to your phone. This is a MUST."},
  {num:4,  turnIn:false, title:"Download All Members Numbers",        desc:"A list of all FF members has been provided. Save every Signal phone number to your phone."},
  {num:5,  turnIn:false, title:"Install Accountability Software",     desc:"Install accountability software on ALL devices with at least 3 allies. Ask in Signal if anyone has space in their family plans."},
  {num:6,  turnIn:false, title:"Bookmark the FF Meeting Flyer",       desc:"Download the FF Meeting Flyer and mark it for easy access. Sign into one meeting to verify it works. Use the flyer for outreach."},
  {num:7,  turnIn:false, title:"Obtain Recovery Materials",           desc:"Get copies of: AA Big Book, AA 12 Steps and 12 Traditions, SA White Book, SA Step into Action."},
  {num:8,  turnIn:true,  title:"Summarize Steps 1 2 and 3",           desc:"Read Steps 1-3 from AA 12 Steps and 12 Traditions. Write one page of reflections per step. Share with your AP and FF group."},
  {num:9,  turnIn:false, title:"Bookmark the NextMeeting Link",       desc:"Open the NextMeeting link, bookmark it on all browsers. Use it to find 24/7 SA meetings around the world."},
  {num:10, turnIn:true,  title:"Begin 90 Meetings in 90 Days",        desc:"Start your 90-in-90 and document every meeting with date, location, and notes. Only SA and Conquerors or FF meetings count."},
  {num:11, turnIn:true,  title:"Record Your Journey",                 desc:"On a document titled My Program, catalog things you heard in meetings and want to implement to stay sober."},
  {num:12, turnIn:false, title:"Commit to a Service Position",        desc:"Find an ongoing service position in FF or an SA meeting. Doing something once is not being in service."},
  {num:13, turnIn:false, title:"30 Days of Fishing Prayer",           desc:"For 30 days, pray for God to use you to help rescue one man from addiction. Do not stop until He answers."},
  {num:14, turnIn:true,  title:"Write a Time Commitment Statement",   desc:"How will you prioritize your program and recovery above everything else? Present it to your group."},
  {num:15, turnIn:true,  title:"Write a Plan to Help Others",         desc:"How will you help others in the short and long term? Think big. Read it to the group."},
  {num:16, turnIn:true,  title:"How You Will Help Your AP",           desc:"Write out: How I am going to help my accountability partner get and stay sober. Present to your group."},
  {num:17, turnIn:false, title:"Obtain an Accountability Partner",    desc:"Find an AP who talks with you daily. Have them read their items 14 15 and 16 to you before choosing them."},
  {num:18, turnIn:false, title:"Get an SA Sponsor",                   desc:"Obtain an SA sponsor or Temporary Sponsor by completion of 90 days. They must cooperate with the Conquerors curriculum."},
  {num:19, turnIn:false, title:"Find Someone You Are Sponsoring",     desc:"Within 90 days find someone you are sponsoring and working with intensely to help them get free."},
  {num:20, turnIn:false, title:"AP Review of All 21",                 desc:"Have your AP go over all 21 with you looking for holes. You must also go over their 21. Then meet with a leader to review."},
  {num:21, turnIn:true,  title:"Final Certification",                 desc:"Turn all materials in to your leader. Complete the Detox-21, receive final enrollment, and begin Conquerors."}
];

var d21Profile = JSON.parse(localStorage.getItem("ff_d21_profile") || "null");
var d21State   = JSON.parse(localStorage.getItem("ff_d21")         || "{}");
var d21Notes   = JSON.parse(localStorage.getItem("ff_d21_notes")   || "{}");

function initApp() {
  document.getElementById("d21StartDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("logDate").value      = new Date().toISOString().split("T")[0];
  document.getElementById("e90Start").value     = new Date().toISOString().split("T")[0];
  document.getElementById("jDate").value        = new Date().toISOString().split("T")[0];
  document.getElementById("giving-art-img").src = getImg("img-seventh-tradition");
  renderMeetings("all");
  if (d21Profile) showD21Main();
  if (n90Data) renderProgress();
  renderLogTable();
  renderJournal();
  loadMapMembers();
  var modal = document.getElementById("mapModal");
  if (modal) modal.addEventListener("click", function(e) { if (e.target === this) closeMapModal(); });
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function enrollD21() {
  var name  = document.getElementById("d21Name").value.trim();
  var start = document.getElementById("d21StartDate").value;
  var ap    = document.getElementById("d21APName").value.trim();
  if (!name || !start) { showToast("Enter your name and start date."); return; }
  d21Profile = {name:name, start:start, ap:ap};
  localStorage.setItem("ff_d21_profile", JSON.stringify(d21Profile));
  showD21Main();
}

function showD21Main() {
  document.getElementById("d21EnrollWrap").style.display = "none";
  document.getElementById("d21MainWrap").style.display   = "block";
  document.getElementById("d21NameDisplay").textContent  = d21Profile.name;
  document.getElementById("d21APDisplay").textContent    = d21Profile.ap || "Not yet set";
  document.getElementById("d21StartDisplay").textContent = new Date(d21Profile.start + "T12:00:00").toLocaleDateString();
  renderD21List();
  updateD21Stats();
}

function renderD21List() {
  var list = document.getElementById("d21List");
  var html = "";
  for (var i = 0; i < D21.length; i++) {
    var item  = D21[i];
    var done  = !!d21State[item.num];
    var note  = d21Notes[item.num] || "";
    var badges = done ? '<span class="badge badge-green">&#10003; Complete</span>' : "";
    if (item.turnIn) badges += '<span class="badge badge-gold">Turn In to Leader</span>';
    html += '<div class="d21-item' + (done ? " completed" : "") + '" id="d21item-' + item.num + '">'
      + '<div class="d21-item-row">'
      + '<div class="d21-check' + (done ? " done" : "") + '" onclick="toggleD21(' + item.num + ')">' + (done ? "&#10003;" : "") + '</div>'
      + '<div class="d21-num">#' + item.num + '</div>'
      + '<div class="d21-body">'
      + '<div class="d21-title">' + item.title + '</div>'
      + '<div class="d21-desc">' + item.desc + '</div>'
      + '<div class="d21-badges">' + badges + '</div>'
      + '<button class="d21-notes-btn" onclick="toggleD21Notes(' + item.num + ',this)">' + (note ? "&#9660; View notes" : "&#9658; Add notes") + '</button>'
      + '<div class="d21-notes-wrap"><textarea class="d21-notes-input" id="d21note-' + item.num + '" placeholder="Notes, reflections, AP name..." onblur="saveD21Note(' + item.num + ')">' + note + '</textarea></div>'
      + '</div></div></div>';
  }
  list.innerHTML = html;
}

function toggleD21(num) {
  d21State[num] = !d21State[num];
  localStorage.setItem("ff_d21", JSON.stringify(d21State));
  renderD21List();
  updateD21Stats();
  showToast(d21State[num] ? "Item " + num + " complete!" : "Item " + num + " unchecked");
}

function toggleD21Notes(num, btn) {
  var item = document.getElementById("d21item-" + num);
  item.classList.toggle("expanded");
  var note = d21Notes[num] || "";
  btn.textContent = item.classList.contains("expanded") ? "\u25BC Hide notes" : (note ? "\u25BC View notes" : "\u25B6 Add notes");
}

function saveD21Note(num) {
  var val = document.getElementById("d21note-" + num).value;
  d21Notes[num] = val;
  localStorage.setItem("ff_d21_notes", JSON.stringify(d21Notes));
  var btn = document.querySelector("#d21item-" + num + " .d21-notes-btn");
  if (btn) btn.textContent = val ? "\u25BC View notes" : "\u25B6 Add notes";
}

function updateD21Stats() {
  var done = 0;
  for (var k in d21State) { if (d21State[k]) done++; }
  var pct = Math.round((done / 21) * 100);
  document.getElementById("d21StatDone").textContent    = done;
  document.getElementById("d21StatLeft").textContent    = 21 - done;
  document.getElementById("d21StatPct").textContent     = pct + "%";
  document.getElementById("d21ProgFill").style.width    = pct + "%";
  document.getElementById("d21PctText").textContent     = pct + "%";
  document.getElementById("d21Circle").style.strokeDashoffset = 263.9 * (1 - done / 21);
}

function resetD21() {
  if (!confirm("Reset your Detox-21 progress and enrollment?")) return;
  d21State = {}; d21Notes = {}; d21Profile = null;
  localStorage.removeItem("ff_d21");
  localStorage.removeItem("ff_d21_notes");
  localStorage.removeItem("ff_d21_profile");
  document.getElementById("d21EnrollWrap").style.display = "block";
  document.getElementById("d21MainWrap").style.display   = "none";
  showToast("Detox-21 reset.");
}

function exportD21() {
  var done = 0;
  for (var k in d21State) { if (d21State[k]) done++; }
  var lines = [
    "FINALLY FREE - DETOX-21 PROGRESS",
    "Name: " + d21Profile.name,
    "AP: "   + (d21Profile.ap || "Not set"),
    "Started: " + d21Profile.start,
    "Generated: " + new Date().toLocaleDateString(), ""
  ];
  for (var i = 0; i < D21.length; i++) {
    var item = D21[i];
    var chk  = d21State[item.num] ? "[x]" : "[ ]";
    var ti   = item.turnIn ? " (TURN IN)" : "";
    var note = d21Notes[item.num] ? "\n    Notes: " + d21Notes[item.num] : "";
    lines.push(chk + " #" + item.num + " - " + item.title + ti + note);
  }
  lines.push("", "Progress: " + done + "/21 (" + Math.round(done/21*100) + "%)");
  download("FF-Detox21.txt", lines.join("\n"));
}

// ── 90-IN-90 ──
var n90Data    = JSON.parse(localStorage.getItem("ff_90in90") || "null");
var logEntries = JSON.parse(localStorage.getItem("ff_90log")  || "[]");

function switchN90(panel, btn) {
  var tabs   = document.querySelectorAll("#n90Tabs .tab");
  var panels = document.querySelectorAll("#ninety-section .tab-panel");
  for (var i = 0; i < tabs.length;   i++) tabs[i].classList.remove("active");
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove("active");
  btn.classList.add("active");
  document.getElementById("n90-" + panel).classList.add("active");
  if (panel === "leaderboard") loadLeaderboard();
  if (panel === "log") renderLogTable();
}

function enroll90() {
  var name  = document.getElementById("e90Name").value.trim();
  var start = document.getElementById("e90Start").value;
  if (!name || !start) { showToast("Enter your name and start date."); return; }
  n90Data = {name:name, start:start};
  localStorage.setItem("ff_90in90", JSON.stringify(n90Data));
  renderProgress();
  submitLeaderboard(name, logEntries.length);
}

function resetN90() {
  if (!confirm("Reset enrollment? Log will be kept.")) return;
  localStorage.removeItem("ff_90in90");
  n90Data = null;
  document.getElementById("enrollFormWrap").style.display = "block";
  document.getElementById("progressWrap").style.display   = "none";
}

function renderProgress() {
  if (!n90Data) return;
  document.getElementById("enrollFormWrap").style.display = "none";
  document.getElementById("progressWrap").style.display   = "block";
  var done   = logEntries.length;
  var pct    = Math.min(100, Math.round(done / 90 * 100));
  var streak = calcStreak();
  document.getElementById("pb-name").textContent     = n90Data.name;
  document.getElementById("stat-done").textContent   = done;
  document.getElementById("stat-left").textContent   = Math.max(0, 90 - done);
  document.getElementById("stat-streak").textContent = streak;
  document.getElementById("pct-text").textContent    = pct + "%";
  document.getElementById("progressCircle").style.strokeDashoffset = 301.6 * (1 - done / 90);
  var s = new Date(n90Data.start + "T12:00:00");
  var t = new Date(s.getTime() + 89 * 86400000);
  document.getElementById("pb-start").textContent  = s.toLocaleDateString();
  document.getElementById("pb-target").textContent = t.toLocaleDateString();
}

function calcStreak() {
  if (!logEntries.length) return 0;
  var dates = {};
  for (var i = 0; i < logEntries.length; i++) dates[logEntries[i].date] = true;
  var streak = 0, d = new Date();
  for (var i = 0; i < 90; i++) {
    var key = d.toISOString().split("T")[0];
    if (dates[key]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function addLogEntry() {
  if (!n90Data) { showToast("Enroll first in the My Progress tab."); return; }
  var num   = parseInt(document.getElementById("logNum").value) || logEntries.length + 1;
  var date  = document.getElementById("logDate").value;
  var loc   = document.getElementById("logLoc").value.trim();
  var notes = document.getElementById("logNotes").value.trim();
  if (!date || !loc) { showToast("Date and location are required."); return; }
  var filtered = [];
  for (var i = 0; i < logEntries.length; i++) { if (logEntries[i].num !== num) filtered.push(logEntries[i]); }
  filtered.push({num:num, date:date, loc:loc, notes:notes, id:Date.now()});
  filtered.sort(function(a,b){ return a.num - b.num; });
  logEntries = filtered;
  localStorage.setItem("ff_90log", JSON.stringify(logEntries));
  renderLogTable();
  renderProgress();
  submitLeaderboard(n90Data.name, logEntries.length);
  document.getElementById("logLoc").value   = "";
  document.getElementById("logNotes").value = "";
  document.getElementById("logNum").value   = logEntries.length + 1;
  showToast("Meeting #" + num + " logged!");
}

function deleteLog(id) {
  var filtered = [];
  for (var i = 0; i < logEntries.length; i++) { if (logEntries[i].id !== id) filtered.push(logEntries[i]); }
  logEntries = filtered;
  localStorage.setItem("ff_90log", JSON.stringify(logEntries));
  renderLogTable();
  renderProgress();
}

function renderLogTable() {
  var tbody = document.getElementById("logTableBody");
  var empty = document.getElementById("logEmpty");
  document.getElementById("logCount").textContent = logEntries.length + " of 90 meetings logged";
  document.getElementById("logNum").value = logEntries.length + 1;
  if (!logEntries.length) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  var html = "";
  for (var i = 0; i < logEntries.length; i++) {
    var e = logEntries[i];
    var d = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", {month:"short",day:"numeric",year:"2-digit"});
    html += "<tr>"
      + "<td class='log-day-num'>#" + e.num + "</td>"
      + "<td>" + d + "</td>"
      + "<td>" + (e.loc || "") + "</td>"
      + "<td style='max-width:200px;word-break:break-word;'>" + (e.notes || "&mdash;") + "</td>"
      + "<td><button onclick='deleteLog(" + e.id + ")' style='background:none;border:none;color:rgba(138,155,181,.35);cursor:pointer;font-size:.85rem;' onmouseover='this.style.color=\"#c0392b\"' onmouseout='this.style.color=\"rgba(138,155,181,.35)\"'>&#10005;</button></td>"
      + "</tr>";
  }
  tbody.innerHTML = html;
}

function exportLog() {
  var lines = [
    "FINALLY FREE - 90-IN-90 MEETING LOG",
    "Name: " + (n90Data ? n90Data.name : ""),
    "Start: " + (n90Data ? n90Data.start : ""),
    "Generated: " + new Date().toLocaleDateString(), "",
    "#    Date            Location / Name              Notes"
  ];
  for (var i = 0; i < logEntries.length; i++) {
    var e = logEntries[i];
    var d = new Date(e.date + "T12:00:00").toLocaleDateString();
    var num = ("  " + e.num).slice(-3);
    lines.push(num + "  " + d + "  " + (e.loc || "") + "  " + (e.notes || ""));
  }
  lines.push("", "Total: " + logEntries.length + "/90");
  download("FF-90in90-Log.txt", lines.join("\n"));
}

async function submitLeaderboard(name, count) {
  try {
    var key = "ff_leaderboard";
    var board = {};
    try { var r = await window.storage.get(key, true); if (r && r.value) board = JSON.parse(r.value); } catch(e) {}
    board[name] = count;
    await window.storage.set(key, JSON.stringify(board), true);
  } catch(e) {}
}

async function loadLeaderboard() {
  var el = document.getElementById("leaderboardList");
  el.innerHTML = "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>Loading...</p>";
  try {
    var res = await window.storage.get("ff_leaderboard", true);
    if (!res || !res.value) {
      el.innerHTML = "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>No brothers enrolled yet - be first!</p>";
      return;
    }
    var board = JSON.parse(res.value);
    if (n90Data) board[n90Data.name] = logEntries.length;
    var sorted = Object.entries(board).sort(function(a,b){ return b[1]-a[1]; });
    var medals = ["1st","2nd","3rd"];
    var html = "";
    for (var i = 0; i < sorted.length; i++) {
      var bname = sorted[i][0], bcount = sorted[i][1];
      var pct = Math.min(100, Math.round(bcount / 90 * 100));
      html += "<div class='lb-row'>"
        + "<div class='lb-rank'>" + (medals[i] || (i+1) + "th") + "</div>"
        + "<div class='lb-name'>" + bname + "</div>"
        + "<div style='display:flex;align-items:center;gap:.6rem;'>"
        + "<div class='lb-bar-wrap'><div class='lb-bar' style='width:" + pct + "%'></div></div>"
        + "<div class='lb-count'>" + bcount + "/90 (" + pct + "%)</div>"
        + "</div></div>";
    }
    el.innerHTML = html || "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>No data yet.</p>";
  } catch(e) {
    el.innerHTML = "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>Board unavailable.</p>";
  }
}

// ── JOURNAL ──
var journalEntries = JSON.parse(localStorage.getItem("ff_journal") || "[]");

function handleMeetingSelect() {
  var val  = document.getElementById("jMeeting").value;
  var wrap = document.getElementById("otherMeetingWrap");
  wrap.className = "other-wrap" + (val === "__other__" ? " show" : "");
}

function addJournalEntry() {
  var sel     = document.getElementById("jMeeting").value;
  var meeting = sel === "__other__" ? document.getElementById("otherMeeting").value.trim() : sel;
  if (sel === "__other__" && !meeting) { showToast("Enter the meeting name."); return; }
  var date    = document.getElementById("jDate").value;
  var mood    = document.getElementById("jMood").value;
  var notes   = document.getElementById("jNotes").value.trim();
  var insight = document.getElementById("jInsight").value.trim();
  if (!meeting || !date || !notes) { showToast("Select a meeting, add a date and notes."); return; }
  journalEntries.unshift({id:Date.now(), meeting:meeting, date:date, mood:mood, notes:notes, insight:insight, isOther:(sel==="__other__")});
  localStorage.setItem("ff_journal", JSON.stringify(journalEntries));
  renderJournal();
  document.getElementById("jMeeting").value              = "";
  document.getElementById("otherMeeting").value          = "";
  document.getElementById("otherMeetingWrap").className  = "other-wrap";
  document.getElementById("jNotes").value                = "";
  document.getElementById("jInsight").value              = "";
  showToast("Journal entry saved!");
}

function deleteJEntry(id) {
  var filtered = [];
  for (var i = 0; i < journalEntries.length; i++) { if (journalEntries[i].id !== id) filtered.push(journalEntries[i]); }
  journalEntries = filtered;
  localStorage.setItem("ff_journal", JSON.stringify(journalEntries));
  renderJournal();
}

function renderJournal() {
  var filter  = document.getElementById("jFilter").value;
  var entries = journalEntries;
  if (filter === "__other__") entries = journalEntries.filter(function(e){ return e.isOther; });
  else if (filter !== "all")  entries = journalEntries.filter(function(e){ return e.meeting === filter; });
  document.getElementById("journalCount").textContent = journalEntries.length + (journalEntries.length === 1 ? " entry" : " entries");
  var el = document.getElementById("journalEntries");
  if (!entries.length) { el.innerHTML = "<p class='j-empty'>No entries yet. Log your first meeting.</p>"; return; }
  var html = "";
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var d = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", {weekday:"short",month:"short",day:"numeric",year:"numeric"});
    var notesHtml = e.notes ? e.notes.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>") : "";
    html += "<div class='j-entry'>"
      + "<div class='j-entry-header'>"
      + "<div><div class='j-meeting-name'>" + e.meeting + "</div><div class='j-entry-date'>" + d + "</div></div>"
      + "<div style='display:flex;align-items:center;gap:.4rem;'><span style='font-size:1.1rem;'>" + e.mood + "</span>"
      + "<button class='j-delete' onclick='deleteJEntry(" + e.id + ")'>&#10005;</button></div>"
      + "</div>"
      + "<div class='j-entry-text'>" + notesHtml + "</div>"
      + (e.insight ? "<div class='j-entry-insight'><span>Key insight:</span> " + e.insight + "</div>" : "")
      + "</div>";
  }
  el.innerHTML = html;
}

// ── MAP ──
var mapMembers = [];

async function loadMapMembers() {
  try {
    var r = await window.storage.get("ff_brotherhood_map", true);
    if (r && r.value) mapMembers = JSON.parse(r.value);
  } catch(e) {
    try { var l = localStorage.getItem("ff_brotherhood_map"); if (l) mapMembers = JSON.parse(l); } catch(e2) {}
  }
  renderMap();
}

async function saveMapMembers() {
  var json = JSON.stringify(mapMembers);
  try { await window.storage.set("ff_brotherhood_map", json, true); }
  catch(e) { try { localStorage.setItem("ff_brotherhood_map", json); } catch(e2) {} }
}

function geoToSVG(lat, lng) {
  var x     = (lng + 180) * (1000 / 360);
  var latR  = lat * Math.PI / 180;
  var mercN = Math.log(Math.tan(Math.PI / 4 + latR / 2));
  var y     = 250 - (500 * mercN / (2 * Math.PI));
  return {x: Math.max(5, Math.min(995, x)), y: Math.max(5, Math.min(495, y))};
}

function renderMap() {
  var dots = document.querySelectorAll(".member-dot");
  for (var i = 0; i < dots.length; i++) dots[i].remove();
  var svg  = document.getElementById("world-map");
  var list = document.getElementById("membersList");
  for (var i = 0; i < mapMembers.length; i++) {
    (function(m, idx) {
      var pos   = geoToSVG(m.lat, m.lng);
      var g     = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "member-dot");
      g.setAttribute("transform", "translate(" + pos.x.toFixed(1) + "," + pos.y.toFixed(1) + ")");
      var pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pulse.setAttribute("r", "7");
      pulse.setAttribute("fill", "rgba(201,151,58,.2)");
      pulse.style.animation       = "ping 2s ease-out " + ((idx * 0.4) % 2) + "s infinite";
      pulse.style.transformOrigin = "center";
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "4.5");
      dot.setAttribute("fill", "#c9973a");
      dot.setAttribute("stroke", "#f5dfa0");
      dot.setAttribute("stroke-width", "1.5");
      g.appendChild(pulse);
      g.appendChild(dot);
      svg.appendChild(g);
      g.addEventListener("mouseenter", function() {
        var tt  = document.getElementById("mapTooltip");
        var con = document.querySelector(".map-wrap");
        document.getElementById("ttName").textContent    = m.name;
        document.getElementById("ttLoc").textContent     = m.city + (m.country ? ", " + m.country : "");
        document.getElementById("ttContact").textContent = m.contact || "";
        tt.style.display = "block";
        var cr   = con.getBoundingClientRect();
        var gr   = g.getBoundingClientRect();
        var left = gr.left - cr.left + 12;
        var top  = gr.top  - cr.top  - 75;
        if (left + 200 > cr.width) left = left - 210;
        if (top < 5) top = gr.top - cr.top + 15;
        tt.style.left = left + "px";
        tt.style.top  = top  + "px";
      });
      g.addEventListener("mouseleave", function() {
        document.getElementById("mapTooltip").style.display = "none";
      });
    })(mapMembers[i], i);
  }
  document.getElementById("memberCountBadge").textContent = mapMembers.length + (mapMembers.length === 1 ? " brother" : " brothers") + " on the map";
  var pillHtml = "";
  for (var i = 0; i < mapMembers.length; i++) {
    var m = mapMembers[i];
    pillHtml += "<div class='member-pill'>"
      + "<div class='mp-name'>" + m.name + "</div>"
      + "<div class='mp-loc'>" + m.city + (m.country ? ", " + m.country : "") + "</div>"
      + (m.contact ? "<div class='mp-contact'>" + m.contact + "</div>" : "")
      + "</div>";
  }
  list.innerHTML = pillHtml || "<p style='font-size:.8rem;color:var(--gray);font-style:italic;'>Be the first to place your pin, brother.</p>";
}

function openMapModal()  { document.getElementById("mapModal").classList.add("open"); }
function closeMapModal() { document.getElementById("mapModal").classList.remove("open"); }

async function submitMember() {
  var name    = document.getElementById("mName").value.trim();
  var city    = document.getElementById("mCity").value.trim();
  var country = document.getElementById("mCountry").value.trim();
  var contact = document.getElementById("mContact").value.trim();
  var lat     = parseFloat(document.getElementById("mLat").value);
  var lng     = parseFloat(document.getElementById("mLng").value);
  if (!name || !city || isNaN(lat) || isNaN(lng)) { showToast("Fill in name, city, and coordinates."); return; }
  mapMembers.push({name:name, city:city, country:country, contact:contact, lat:lat, lng:lng, added:Date.now()});
  await saveMapMembers();
  renderMap();
  closeMapModal();
  showToast("Pin placed! Welcome to the map, brother.");
  var fields = ["mName","mCity","mCountry","mContact","mLat","mLng"];
  for (var i = 0; i < fields.length; i++) document.getElementById(fields[i]).value = "";
}



// ── UTILITIES ──
function showToast(msg) {
  var t = document.getElementById("toast");
  t.innerHTML = msg;
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 3500);
}

function download(filename, text) {
  var a    = document.createElement("a");
  a.href   = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
