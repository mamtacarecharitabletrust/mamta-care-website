// Mamta Care Donor Desk: surgical production-source patch; REVIEW FIRST, NO AUTO-DEPLOY.
// Run against the original downloaded Worker and test before any production rollout.
// node scripts/patch-donor-desk-hair-length-pending.mjs < donor-desk.mjs > candidate.mjs
import fs from 'node:fs';
let code=fs.readFileSync(0,'utf8');
function change(before,after,expected,name){
 const count=code.split(before).length-1;
 if(count!==expected)throw Error(name+': expected '+expected+' matching locations, found '+count);
 code=code.split(before).join(after);
}
// The source already reads donors.hair_length, populated from Google Sheet column E.
// Show the DONOR'S SELECTED length (not a verified or AI-measured length) on both desktop/mobile UI copies.
const detailsEnd='</h2><div id="donorPhotoPanel"';
const lengthBadge='</h2><div class="mc-length-badge" style="padding:12px 15px;margin:12px 0;border:1px solid #9bdbc3;border-radius:12px;background:#eafaf2;color:#124b34;font-size:14px"><b>SELECTED HAIR DONATION: </b><span style="font-weight:750">'+
  "'+escapeHtml((d.hair_length||'Not recorded').replace(/INCHES/gi,' inches').replace(/(\\d)\\s*-\\s*(\\d)/,'$1–$2'))+'</span></div><div id=\"donorPhotoPanel\"";
change(detailsEnd,lengthBadge,2,'details badge');
// Add red Pending per employee, derived from Pending/Not answered/Call again statuses.
const sql="SUM(CASE WHEN d.followup_status='Completed' THEN 1 ELSE 0 END) AS completed";
change(sql,sql+",\n      SUM(CASE WHEN d.followup_status IN ('Pending','Not answered','Call again') THEN 1 ELSE 0 END) AS pending",1,'staff SQL');
const chip="+Number(m.completed||0)+' completed</span>'";
change(chip,"+Number(m.completed||0)+' completed · <b style=\"color:#c62828\">Pending: '+Number(m.pending||0)+'</b></span>'",2,'staff summary');
process.stdout.write(code);
